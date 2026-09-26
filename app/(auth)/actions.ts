"use server";

import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { ensurePersonalHousehold } from "@/lib/households";
import { type ActionResult, validationError } from "@/lib/action-result";
import { forgotPasswordSchema, registerSchema, resetPasswordSchema } from "@/lib/validations/auth";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerUser(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const { name, email, password } = parsed.data;

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });
    await ensurePersonalHousehold(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, fieldErrors: { email: ["Esiste già un account con questa email"] } };
    }
    throw err;
  }
  return { ok: true };
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

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

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!record || record.expiresAt < new Date()) {
    return { ok: false, error: "Il link non è valido o è scaduto. Richiedine uno nuovo." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);
  return { ok: true };
}
