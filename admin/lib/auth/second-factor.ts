import { prisma } from "@/lib/db";
import { hashRecoveryCode, normalizeRecoveryCode, open } from "./secrets";
import { normalizeTotp, verifyTotp } from "./totp";

export type AdminSecondFactor = {
  id: string;
  totpSecret: string;
  totpLastStep: number | null;
};

/**
 * The admin's code: from the authenticator app (never the same one twice) or a recovery code
 * (spent by removing it). Both updates are conditional, so two requests can't use one code.
 */
export async function checkAdminCode(admin: AdminSecondFactor, input: string) {
  const totp = normalizeTotp(input);
  if (totp) {
    const secret = open(admin.totpSecret);
    if (!secret) return false;
    const step = verifyTotp(secret, totp, { lastStep: admin.totpLastStep });
    if (step === null) return false;
    const { count } = await prisma.adminUser.updateMany({
      where: { id: admin.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return count === 1;
  }
  const recovery = normalizeRecoveryCode(input);
  if (!recovery) return false;
  const hash = hashRecoveryCode(recovery);
  const removed = await prisma.$executeRaw`
    UPDATE "admin_users" SET "recovery_codes" = array_remove("recovery_codes", ${hash})
    WHERE "id" = ${admin.id} AND ${hash} = ANY("recovery_codes")`;
  return removed === 1;
}
