import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkSecondFactor } from "./two-factor";
import { seal } from "./secret-box";
import { totpCode, totpStep } from "./totp";
import { hashRecoveryCode } from "./recovery-codes";

const { prisma, rateLimit, refundRateLimit } = vi.hoisted(() => ({
  prisma: {
    user: { updateMany: vi.fn() },
    recoveryCode: { deleteMany: vi.fn(), count: vi.fn() },
  },
  rateLimit: vi.fn(),
  refundRateLimit: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/rate-limit", () => ({
  RULES: {
    twoFactor: { limit: 5, windowSeconds: 900 },
    twoFactorDaily: { limit: 20, windowSeconds: 86_400 },
  },
  rateLimit,
  refundRateLimit,
}));

const SECRET = "JBSWY3DPEHPK3PXP";
const NOW = new Date("2026-10-09T10:00:00Z");
let user: { id: string; totpSecret: string | null; totpLastStep: number | null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  user = { id: "user-1", totpSecret: seal(SECRET), totpLastStep: null };
  rateLimit.mockResolvedValue({ ok: true, remaining: 4, retryAfterSeconds: 0 });
  prisma.user.updateMany.mockResolvedValue({ count: 1 });
  prisma.recoveryCode.deleteMany.mockResolvedValue({ count: 1 });
  prisma.recoveryCode.count.mockResolvedValue(7);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("checkSecondFactor", () => {
  it("accepts the app's current code, remembers its step and gives the try back", async () => {
    const step = totpStep(NOW.getTime());
    const result = await checkSecondFactor(user, totpCode(SECRET, step));
    expect(result).toEqual({ ok: true, method: "totp" });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    expect(refundRateLimit).toHaveBeenCalledTimes(2);
  });

  it("refuses a code another request already used", async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    const result = await checkSecondFactor(user, totpCode(SECRET, totpStep(NOW.getTime())));
    expect(result).toEqual({ ok: false, error: "BAD_CODE" });
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  it("refuses a wrong code and keeps the try", async () => {
    const wrong = totpCode(SECRET, totpStep(NOW.getTime()) + 5);
    expect(await checkSecondFactor(user, wrong)).toEqual({ ok: false, error: "BAD_CODE" });
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  it("refuses codes when the secret can't be read (another key)", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "rotated");
    const code = totpCode(SECRET, totpStep(NOW.getTime()));
    expect(await checkSecondFactor(user, code)).toEqual({ ok: false, error: "BAD_CODE" });
  });

  it("spends a recovery code by deleting it, and says how many are left", async () => {
    const result = await checkSecondFactor(user, "K7M2P-X9QRT");
    expect(result).toEqual({ ok: true, method: "recovery", remaining: 7 });
    expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", codeHash: hashRecoveryCode("k7m2px9qrt") },
    });
  });

  it("refuses a recovery code already used", async () => {
    prisma.recoveryCode.deleteMany.mockResolvedValue({ count: 0 });
    expect(await checkSecondFactor(user, "k7m2p-x9qrt")).toEqual({ ok: false, error: "BAD_CODE" });
  });

  it("stops checking when the account had too many tries", async () => {
    rateLimit
      .mockResolvedValueOnce({ ok: true, remaining: 0, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ ok: false, remaining: 0, retryAfterSeconds: 3600 });
    const result = await checkSecondFactor(user, totpCode(SECRET, totpStep(NOW.getTime())));
    expect(result).toEqual({ ok: false, error: "RATE_LIMITED", retryAfterSeconds: 3600 });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
