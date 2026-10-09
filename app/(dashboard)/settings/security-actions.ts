"use server";

import QRCode from "qrcode";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordProblem } from "@/lib/auth/password-policy";
import { seal } from "@/lib/auth/secret-box";
import { generateTotpSecret, groupSecret, otpauthUri } from "@/lib/auth/totp";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "@/lib/auth/recovery-codes";
import { checkSecondFactor, type SecondFactorUser } from "@/lib/auth/two-factor";
import { currentDevice, issueTicket } from "@/lib/auth/login-ticket";
import { notifyPasswordChanged, notifyTwoFactor } from "@/lib/auth/security-emails";
import { formatRetryAfter, rateLimit, RULES } from "@/lib/rate-limit";
import { type ActionResult, validationError } from "@/lib/action-result";
import {
  changePasswordSchema,
  reauthSchema,
  reauthWithCodeSchema,
  totpCodeSchema,
} from "@/lib/validations/auth";

/*
 * Settings that make the account safer or weaker. Each asks again for the password (and the
 * 2FA code when it's on), so a session left open on someone else's computer isn't enough to
 * change them. Those that sign the other devices out return a ticket: the browser trades it for
 * a new session right away, so this one stays signed in.
 */

export type TwoFactorSetup = ActionResult & { secret?: string; qr?: string; uri?: string };

/** `ticket`: the new session for this browser; `codes`: recovery codes, shown once. */
export type SecurityResult = ActionResult & { ticket?: string; codes?: string[] };

const securityUser = (id: string) =>
  prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      twoFactorEnabledAt: true,
      totpSecret: true,
      totpLastStep: true,
    },
  });

/** The password again, with its own limit: a stolen session can't be used to guess it. */
async function checkPassword(
  userId: string,
  password: string,
  hash: string,
  field = "password",
): Promise<ActionResult | null> {
  const limit = await rateLimit(`reauth:${userId}`, RULES.reauth);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Troppi tentativi: riprova tra ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    };
  }
  if (await verifyPassword(password, hash)) return null;
  return { ok: false, fieldErrors: { [field]: ["Password non corretta"] } };
}

async function checkCode(user: SecondFactorUser, code: string): Promise<ActionResult | null> {
  const check = await checkSecondFactor(user, code);
  if (check.ok) return null;
  if (check.error === "RATE_LIMITED") {
    return {
      ok: false,
      error: `Troppi codici sbagliati: riprova tra ${formatRetryAfter(check.retryAfterSeconds)}.`,
    };
  }
  return { ok: false, fieldErrors: { code: ["Codice non valido"] } };
}

function newRecoveryCodes(userId: string) {
  const codes = generateRecoveryCodes();
  const rows = codes.map((code) => ({
    userId,
    codeHash: hashRecoveryCode(normalizeRecoveryCode(code)!),
  }));
  return { codes, rows };
}

/** Step 1 of turning 2FA on: a new secret, shown as a QR code for the authenticator app. */
export async function startTwoFactorSetup(input: unknown): Promise<TwoFactorSetup> {
  const session = await requireUser();
  const parsed = reauthSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const user = await securityUser(session.id);
  if (user.twoFactorEnabledAt) {
    return { ok: false, error: "La verifica in due passaggi è già attiva." };
  }
  const wrong = await checkPassword(user.id, parsed.data.password, user.passwordHash);
  if (wrong) return wrong;

  const secret = generateTotpSecret();
  // Stored now but not in use until a code from the app confirms it was scanned.
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: seal(secret), totpLastStep: null },
  });
  const uri = otpauthUri(secret, user.email);
  const qr = await QRCode.toString(uri, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
  return { ok: true, secret: groupSecret(secret), qr, uri };
}

/** Step 2: the first code from the app turns 2FA on and gives the recovery codes. */
export async function confirmTwoFactorSetup(input: unknown): Promise<SecurityResult> {
  const session = await requireUser();
  const parsed = totpCodeSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const user = await securityUser(session.id);
  if (user.twoFactorEnabledAt) {
    return { ok: false, error: "La verifica in due passaggi è già attiva." };
  }
  if (!user.totpSecret) {
    return { ok: false, error: "La configurazione è scaduta: ricomincia da capo." };
  }
  const wrong = await checkCode(user, parsed.data.code);
  if (wrong) {
    return wrong.fieldErrors
      ? {
          ok: false,
          fieldErrors: {
            code: ["Codice non valido: controlla che l'ora del telefono sia giusta e riprova"],
          },
        }
      : wrong;
  }

  const { codes, rows } = newRecoveryCodes(user.id);
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.recoveryCode.createMany({ data: rows }),
    // Sessions opened before 2FA (maybe by someone else) end here.
    prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabledAt: new Date(), sessionVersion: { increment: 1 } },
    }),
    prisma.loginTicket.deleteMany({ where: { userId: user.id } }),
  ]);
  const ticket = await issueTicket(user.id, currentDevice(), { secondFactorDone: true });
  await notifyTwoFactor(user, true);
  return { ok: true, codes, ticket };
}

export async function disableTwoFactor(input: unknown): Promise<SecurityResult> {
  const session = await requireUser();
  const parsed = reauthWithCodeSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const user = await securityUser(session.id);
  if (!user.twoFactorEnabledAt) return { ok: true };
  const wrong =
    (await checkPassword(user.id, parsed.data.password, user.passwordHash)) ??
    (await checkCode(user, parsed.data.code));
  if (wrong) return wrong;

  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: null,
        twoFactorEnabledAt: null,
        totpLastStep: null,
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.loginTicket.deleteMany({ where: { userId: user.id } }),
  ]);
  const ticket = await issueTicket(user.id, currentDevice(), { secondFactorDone: true });
  await notifyTwoFactor(user, false);
  return { ok: true, ticket };
}

/** Ten new recovery codes; the old ones stop working. */
export async function regenerateRecoveryCodes(input: unknown): Promise<SecurityResult> {
  const session = await requireUser();
  const parsed = reauthWithCodeSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const user = await securityUser(session.id);
  if (!user.twoFactorEnabledAt) {
    return { ok: false, error: "Prima attiva la verifica in due passaggi." };
  }
  const wrong =
    (await checkPassword(user.id, parsed.data.password, user.passwordHash)) ??
    (await checkCode(user, parsed.data.code));
  if (wrong) return wrong;

  const { codes, rows } = newRecoveryCodes(user.id);
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.recoveryCode.createMany({ data: rows }),
  ]);
  return { ok: true, codes };
}

export async function changePassword(input: unknown): Promise<SecurityResult> {
  const session = await requireUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { current, password, code } = parsed.data;

  const user = await securityUser(session.id);
  const wrong = await checkPassword(user.id, current, user.passwordHash, "current");
  if (wrong) return wrong;
  if (password === current) {
    return {
      ok: false,
      fieldErrors: { password: ["La nuova password è uguale a quella di adesso"] },
    };
  }
  const problem = await passwordProblem(password, user);
  if (problem) return { ok: false, fieldErrors: { password: [problem] } };
  // Last: a code is spent once checked, so it isn't wasted on a password that gets refused.
  if (user.twoFactorEnabledAt) {
    if (!code) return { ok: false, fieldErrors: { code: ["Inserisci il codice"] } };
    const wrongCode = await checkCode(user, code);
    if (wrongCode) return wrongCode;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } },
    }),
    prisma.loginTicket.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
  ]);
  const ticket = await issueTicket(user.id, currentDevice(), { secondFactorDone: true });
  await notifyPasswordChanged(user);
  return { ok: true, ticket };
}

/** Ends every session but this one: e.g. after using a computer that isn't yours. */
export async function signOutOtherDevices(): Promise<SecurityResult> {
  const session = await requireUser();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.id },
      data: { sessionVersion: { increment: 1 } },
    }),
    prisma.loginTicket.deleteMany({ where: { userId: session.id } }),
  ]);
  const ticket = await issueTicket(session.id, currentDevice(), { secondFactorDone: true });
  return { ok: true, ticket };
}
