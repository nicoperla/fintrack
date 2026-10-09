"use server";

import { createHash, timingSafeEqual } from "crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { clientIp } from "@/lib/request";
import { rateLimit, RULES, waitText } from "@/lib/rate-limit";
import {
  adminPasswordProblem,
  generateRecoveryCodes,
  hashPassword,
  hashRecoveryCode,
  normalizeRecoveryCode,
  open,
  seal,
} from "@/lib/auth/secrets";
import { generateTotpSecret, groupSecret, otpauthUri, verifyTotp } from "@/lib/auth/totp";

/*
 * First admin: only while there's none, and only with ADMIN_SETUP_TOKEN (from the environment,
 * so only who controls the deployment can do it). Two steps: the account and the 2FA secret,
 * then the first code from the app, which activates it.
 */

/** A pending setup is valid this long. */
const PENDING_MS = 30 * 60 * 1000;

export type SetupStart = ActionResult & { secret?: string; qr?: string };

async function guard(token: string): Promise<ActionResult | null> {
  const limit = await rateLimit(`setup:ip:${await clientIp()}`, RULES.setup);
  if (!limit.ok) return fail(`Troppi tentativi. Riprova tra ${waitText(limit.retryAfterSeconds)}.`);
  if ((await prisma.adminUser.count({ where: { activatedAt: { not: null } } })) > 0) {
    return fail("Il pannello ha già un amministratore.");
  }
  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (!expected || expected.length < 16) {
    return fail("Imposta ADMIN_SETUP_TOKEN (almeno 16 caratteri) nelle variabili d'ambiente.");
  }
  // Hashes have the same length, so the comparison takes the same time whatever was typed.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(token), digest(expected))) return fail("Codice di setup errato.");
  return null;
}

const startSchema = z.object({
  token: z.string().max(200),
  name: z.string().trim().min(1, "Inserisci il nome").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Email non valida")),
  password: z.string().max(200),
  confirm: z.string().max(200),
});

export async function startSetup(input: unknown): Promise<SetupStart> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dati non validi.");
  const { token, name, email, password, confirm } = parsed.data;
  const blocked = await guard(token);
  if (blocked) return blocked;
  const problem = adminPasswordProblem(password, email);
  if (problem) return fail(`Password: ${problem.toLowerCase()}.`);
  if (password !== confirm) return fail("Le password non coincidono.");

  const secret = generateTotpSecret();
  await prisma.$transaction([
    // At most one setup in progress.
    prisma.adminUser.deleteMany({ where: { activatedAt: null } }),
    prisma.adminUser.create({
      data: { name, email, passwordHash: await hashPassword(password), totpSecret: seal(secret) },
    }),
  ]);
  const qr = await QRCode.toString(otpauthUri(secret, email), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
  });
  return { ok: true, secret: groupSecret(secret), qr };
}

const confirmSchema = z.object({ token: z.string().max(200), code: z.string().trim().max(10) });

export async function confirmSetup(input: unknown): Promise<ActionResult> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return fail("Inserisci il codice.");
  const blocked = await guard(parsed.data.token);
  if (blocked) return blocked;

  const pending = await prisma.adminUser.findFirst({
    where: { activatedAt: null, createdAt: { gt: new Date(Date.now() - PENDING_MS) } },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) return fail("Il setup è scaduto: ricomincia.");
  const secret = open(pending.totpSecret);
  const step = secret ? verifyTotp(secret, parsed.data.code) : null;
  if (step === null) return fail("Codice non valido: controlla che l'ora del telefono sia giusta.");

  const codes = generateRecoveryCodes();
  await prisma.adminUser.update({
    where: { id: pending.id },
    data: {
      activatedAt: new Date(),
      totpLastStep: step,
      recoveryCodes: codes.map((code) => hashRecoveryCode(normalizeRecoveryCode(code)!)),
    },
  });
  await audit(pending.id, "admin.setup", { details: { email: pending.email } });
  return { ok: true, codes };
}
