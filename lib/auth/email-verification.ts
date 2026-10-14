import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { verificationEmail } from "@/lib/emails/templates";

/*
 * Email confirmation: a link sent at sign-up (and on request). Unconfirmed accounts can use the
 * app, but can't invite people or use the AI coach.
 */

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function sendVerificationEmail(user: {
  id: string;
  email: string;
  name?: string | null;
}) {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);

  const appUrl = getAppUrl();
  const link = `${appUrl}/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    ...verificationEmail({ appUrl, name: user.name, email: user.email, link }),
  });
}

export type VerifyResult = "verified" | "invalid";

export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record || record.expiresAt < new Date()) return "invalid";

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);
  return "verified";
}
