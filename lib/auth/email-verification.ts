import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";

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

  const link = `${getAppUrl()}/verify-email?token=${token}`;
  const hello = user.name ? `Ciao ${user.name.split(" ")[0]},` : "Ciao,";
  await sendEmail({
    to: user.email,
    subject: "Conferma la tua email su FinTrack",
    text: `${hello}\n\nconferma il tuo indirizzo aprendo questo link (valido 48 ore):\n${link}\n\nSe non hai creato tu l'account, ignora questa email.`,
    html: `<p>${hello}</p><p>conferma il tuo indirizzo per completare l'iscrizione a FinTrack:</p><p><a href="${link}">Conferma la mia email</a> (valido 48 ore)</p><p>Se non hai creato tu l'account, ignora questa email.</p>`,
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
