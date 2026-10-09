import { prisma } from "@/lib/db/prisma";
import { open } from "@/lib/auth/secret-box";
import { normalizeTotp, verifyTotp } from "@/lib/auth/totp";
import { hashRecoveryCode, normalizeRecoveryCode } from "@/lib/auth/recovery-codes";
import { rateLimit, refundRateLimit, RULES } from "@/lib/rate-limit";

export type SecondFactorUser = {
  id: string;
  totpSecret: string | null;
  totpLastStep: number | null;
};

export type SecondFactorResult =
  | { ok: true; method: "totp" }
  | { ok: true; method: "recovery"; remaining: number }
  | { ok: false; error: "BAD_CODE" }
  | { ok: false; error: "RATE_LIMITED"; retryAfterSeconds: number };

const BAD_CODE = { ok: false, error: "BAD_CODE" } as const;

/**
 * Checks a code from the authenticator app or a recovery code, at sign-in and before the
 * settings that weaken the account. Every try counts against the per-account limits; the
 * successful ones are given back.
 */
export async function checkSecondFactor(
  user: SecondFactorUser,
  input: string,
): Promise<SecondFactorResult> {
  const keys = [`2fa:${user.id}`, `2fa-day:${user.id}`];
  const [burst, daily] = await Promise.all([
    rateLimit(keys[0], RULES.twoFactor),
    rateLimit(keys[1], RULES.twoFactorDaily),
  ]);
  if (!burst.ok || !daily.ok) {
    return {
      ok: false,
      error: "RATE_LIMITED",
      retryAfterSeconds: Math.max(
        burst.ok ? 0 : burst.retryAfterSeconds,
        daily.ok ? 0 : daily.retryAfterSeconds,
      ),
    };
  }

  const result = await verify(user, input);
  if (result.ok) await Promise.all(keys.map((key) => refundRateLimit(key)));
  return result;
}

async function verify(user: SecondFactorUser, input: string): Promise<SecondFactorResult> {
  const totp = normalizeTotp(input);
  if (totp) {
    const secret = user.totpSecret ? open(user.totpSecret) : null;
    if (!secret) return BAD_CODE;
    const step = verifyTotp(secret, totp, { lastStep: user.totpLastStep });
    if (step === null) return BAD_CODE;
    // Conditional, so two sign-ins racing with the same code can't both get through.
    const { count } = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return count === 1 ? { ok: true, method: "totp" } : BAD_CODE;
  }

  const recovery = normalizeRecoveryCode(input);
  if (recovery) {
    // Deleting is what spends the code: only one request can delete it.
    const { count } = await prisma.recoveryCode.deleteMany({
      where: { userId: user.id, codeHash: hashRecoveryCode(recovery) },
    });
    if (count === 1) {
      const remaining = await prisma.recoveryCode.count({ where: { userId: user.id } });
      return { ok: true, method: "recovery", remaining };
    }
  }
  return BAD_CODE;
}
