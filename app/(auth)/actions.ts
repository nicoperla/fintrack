"use server";

import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordProblem } from "@/lib/auth/password-policy";
import { currentDevice, issueTicket } from "@/lib/auth/login-ticket";
import { notifyPasswordChanged } from "@/lib/auth/security-emails";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { ensurePersonalHousehold } from "@/lib/households";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { type ActionResult, validationError } from "@/lib/action-result";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import { clientIp, formatRetryAfter, rateLimit, RULES } from "@/lib/rate-limit";

const tooMany = (seconds: number): ActionResult => ({
  ok: false,
  error: `Troppi tentativi da questa connessione. Riprova tra ${formatRetryAfter(seconds)}.`,
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** The first step of signing in: a ticket for the browser to trade for a session. */
export type LoginStep = ActionResult & { ticket?: string; needsCode?: boolean };

const WRONG_CREDENTIALS = "Email o password non corretti.";

/**
 * Checks email and password. The answer is a short-lived ticket; when the account has 2FA, the
 * browser must add the code from the authenticator app to get the session (lib/auth/options.ts).
 */
export async function startLogin(input: unknown): Promise<LoginStep> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { email, password } = parsed.data;

  // Before checking the password, so guessing is slowed down whatever the outcome.
  const [byEmail, byIp] = await Promise.all([
    rateLimit(`login:email:${email}`, RULES.loginEmail),
    rateLimit(`login:ip:${clientIp()}`, RULES.loginIp),
  ]);
  if (!byEmail.ok || !byIp.ok) {
    const wait = Math.max(
      byEmail.ok ? 0 : byEmail.retryAfterSeconds,
      byIp.ok ? 0 : byIp.retryAfterSeconds,
    );
    return {
      ok: false,
      error: `Troppi tentativi di accesso. Riprova tra ${formatRetryAfter(wait)}.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, twoFactorEnabledAt: true },
  });
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { ok: false, error: WRONG_CREDENTIALS };

  const ticket = await issueTicket(user.id, currentDevice({ refresh: true }));
  return { ok: true, ticket, needsCode: user.twoFactorEnabledAt !== null };
}

export async function registerUser(input: unknown): Promise<LoginStep> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const { name, email, password } = parsed.data;

  const problem = await passwordProblem(password, { email, name });
  if (problem) return { ok: false, fieldErrors: { password: [problem] } };

  const limit = await rateLimit(`register:ip:${clientIp()}`, RULES.register);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        termsAcceptedAt: new Date(),
      },
    });
    userId = user.id;
    await ensurePersonalHousehold(user);
    // The account works right away; the link only unlocks invites and the AI coach.
    await sendVerificationEmail(user).catch((error) =>
      console.error("[register] invio email di conferma fallito", error),
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, fieldErrors: { email: ["Esiste già un account con questa email"] } };
    }
    throw err;
  }
  // Signed in right away: the new account has no 2FA yet.
  return { ok: true, ticket: await issueTicket(userId, currentDevice({ refresh: true })) };
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const byIp = await rateLimit(`reset:ip:${clientIp()}`, RULES.resetIp);
  if (!byIp.ok) return tooMany(byIp.retryAfterSeconds);
  // Per address the limit is silent: an error would reveal that the account exists.
  const byEmail = await rateLimit(`reset:email:${parsed.data.email}`, RULES.resetEmail);
  if (!byEmail.ok) return { ok: true };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Same response whether or not the account exists, to avoid leaking registered emails.
  if (!user) return { ok: true };

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  const link = `${getAppUrl()}/reset-password?token=${token}`;
  try {
    await sendEmail({
      to: user.email,
      subject: "Reimposta la tua password FinTrack",
      text: `Per reimpostare la password apri questo link (valido 1 ora):\n${link}\n\nSe non hai richiesto il reset, ignora questa email.`,
      html: `<p>Per reimpostare la password clicca qui (valido 1 ora):</p><p><a href="${link}">Reimposta password</a></p><p>Se non hai richiesto il reset, ignora questa email.</p>`,
    });
  } catch (err) {
    console.error("[password-reset] invio email fallito", err);
  }
  return { ok: true };
}

export async function resetPassword(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const limit = await rateLimit(`reset-submit:ip:${clientIp()}`, RULES.resetSubmit);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!record || record.expiresAt < new Date()) {
    return { ok: false, error: "Il link non è valido o è scaduto. Richiedine uno nuovo." };
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: record.userId },
    select: { email: true, name: true },
  });
  const problem = await passwordProblem(parsed.data.password, user);
  if (problem) return { ok: false, fieldErrors: { password: [problem] } };

  // Whoever used the old password is signed out everywhere. 2FA stays as it was: a reset link
  // proves access to the email, not to the phone.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
    prisma.loginTicket.deleteMany({ where: { userId: record.userId } }),
  ]);
  await notifyPasswordChanged(user);
  return { ok: true };
}
