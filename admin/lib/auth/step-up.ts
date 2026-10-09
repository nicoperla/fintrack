import { prisma } from "@/lib/db";
import { rateLimit, RULES, waitText } from "@/lib/rate-limit";
import { checkAdminCode } from "./second-factor";
import { verifyPassword } from "./secrets";

/*
 * Before the actions that can't be undone (deleting a user, removing their 2FA) and the admin's
 * own security settings, the panel asks again for the 2FA code (and sometimes the password):
 * an open session alone isn't enough. Its own rate limit stops guessing from a stolen session.
 */

export async function confirmAdmin(
  adminId: string,
  { code, password }: { code: string; password?: string },
): Promise<string | null> {
  const limit = await rateLimit(`reauth:${adminId}`, RULES.reauth);
  if (!limit.ok) return `Troppi tentativi. Riprova tra ${waitText(limit.retryAfterSeconds)}.`;
  const admin = await prisma.adminUser.findUniqueOrThrow({
    where: { id: adminId },
    select: { id: true, passwordHash: true, totpSecret: true, totpLastStep: true },
  });
  if (password !== undefined && !(await verifyPassword(password, admin.passwordHash))) {
    return "Password non corretta.";
  }
  if (!code.trim() || !(await checkAdminCode(admin, code.trim()))) {
    return "Codice di verifica non valido.";
  }
  return null;
}
