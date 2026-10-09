import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueTicket, MAX_DEVICES, redeemTicket, TICKET_MAX_ATTEMPTS } from "./login-ticket";
import { hashDeviceId } from "./devices";

const { prisma, checkSecondFactor, emails, rateLimit } = vi.hoisted(() => ({
  prisma: {
    loginTicket: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    knownDevice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  checkSecondFactor: vi.fn(),
  emails: {
    notifyNewDevice: vi.fn(),
    notifyRecoveryCodeUsed: vi.fn(),
    notifyWrongCode: vi.fn(),
  },
  rateLimit: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/two-factor", () => ({ checkSecondFactor }));
vi.mock("@/lib/auth/security-emails", () => emails);
vi.mock("@/lib/rate-limit", () => ({
  RULES: { securityAlert: { limit: 1, windowSeconds: 21_600 } },
  rateLimit,
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));

const DEVICE_ID = "d".repeat(43);
const TOKEN = "t".repeat(43);

const user = {
  id: "user-1",
  email: "anna@example.com",
  name: "Anna",
  sessionVersion: 2,
  twoFactorEnabledAt: null as Date | null,
  totpSecret: null,
  totpLastStep: null,
};

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: "ticket-1",
    userId: "user-1",
    deviceHash: hashDeviceId(DEVICE_ID),
    deviceLabel: "Chrome su Windows",
    place: "Milano, IT",
    secondFactorDone: false,
    attempts: 0,
    expiresAt: new Date(Date.now() + 60_000),
    user: { ...user },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.loginTicket.findUnique.mockResolvedValue(ticket());
  prisma.loginTicket.deleteMany.mockResolvedValue({ count: 1 });
  prisma.knownDevice.findUnique.mockResolvedValue({ userId: "user-1" });
  prisma.knownDevice.findMany.mockResolvedValue([]);
  prisma.$transaction.mockResolvedValue([]);
  rateLimit.mockResolvedValue({ ok: true, remaining: 0, retryAfterSeconds: 0 });
});

const redeem = (code?: string, deviceId: string | null = DEVICE_ID) =>
  redeemTicket({ token: TOKEN, code, deviceId });

describe("issueTicket", () => {
  it("stores only a hash, bound to the device, for 10 minutes", async () => {
    const token = await issueTicket("user-1", {
      deviceHash: "hash",
      label: "Safari su iPhone",
      place: null,
    });
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const data = prisma.loginTicket.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(createHash("sha256").update(`ticket:${token}`).digest("hex"));
    expect(data.tokenHash).not.toContain(token);
    expect(data).toMatchObject({ userId: "user-1", deviceHash: "hash", secondFactorDone: false });
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
  });
});

describe("redeemTicket", () => {
  it("signs in an account without 2FA, once", async () => {
    const result = await redeem();
    expect(result).toEqual({
      ok: true,
      user: { id: "user-1", email: "anna@example.com", name: "Anna", sessionVersion: 2 },
    });
    expect(prisma.loginTicket.deleteMany).toHaveBeenCalledWith({ where: { id: "ticket-1" } });
    expect(checkSecondFactor).not.toHaveBeenCalled();
  });

  it("refuses an account suspended after the password step", async () => {
    prisma.loginTicket.findUnique.mockResolvedValue(
      ticket({ user: { ...user, suspendedAt: new Date() } }),
    );
    expect(await redeem()).toEqual({ ok: false, error: "SUSPENDED" });
    expect(prisma.loginTicket.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses a ticket used by a parallel request", async () => {
    prisma.loginTicket.deleteMany.mockResolvedValue({ count: 0 });
    expect(await redeem()).toEqual({ ok: false, error: "EXPIRED" });
  });

  it("refuses unknown, expired and other browsers' tickets", async () => {
    prisma.loginTicket.findUnique.mockResolvedValueOnce(null);
    expect(await redeem()).toEqual({ ok: false, error: "EXPIRED" });
    prisma.loginTicket.findUnique.mockResolvedValueOnce(ticket({ expiresAt: new Date(0) }));
    expect(await redeem()).toEqual({ ok: false, error: "EXPIRED" });
    expect(await redeem(undefined, "x".repeat(43))).toEqual({ ok: false, error: "EXPIRED" });
    expect(await redeem(undefined, null)).toEqual({ ok: false, error: "EXPIRED" });
  });

  describe("with 2FA on", () => {
    beforeEach(() => {
      prisma.loginTicket.findUnique.mockResolvedValue(
        ticket({ user: { ...user, twoFactorEnabledAt: new Date() } }),
      );
    });

    it("asks for the code", async () => {
      expect(await redeem()).toEqual({ ok: false, error: "CODE_REQUIRED" });
      expect(prisma.loginTicket.deleteMany).not.toHaveBeenCalled();
    });

    it("signs in with the right code", async () => {
      checkSecondFactor.mockResolvedValue({ ok: true, method: "totp" });
      expect((await redeem("123456")).ok).toBe(true);
      expect(checkSecondFactor).toHaveBeenCalledWith(
        expect.objectContaining({ id: "user-1" }),
        "123456",
      );
      expect(emails.notifyRecoveryCodeUsed).not.toHaveBeenCalled();
    });

    it("emails when a recovery code was used", async () => {
      checkSecondFactor.mockResolvedValue({ ok: true, method: "recovery", remaining: 3 });
      expect((await redeem("k7m2p-x9qrt")).ok).toBe(true);
      expect(emails.notifyRecoveryCodeUsed).toHaveBeenCalledWith(
        expect.objectContaining({ email: "anna@example.com" }),
        3,
        { device: "Chrome su Windows", place: "Milano, IT" },
      );
    });

    it("counts wrong codes and emails the owner at the third", async () => {
      checkSecondFactor.mockResolvedValue({ ok: false, error: "BAD_CODE" });
      prisma.loginTicket.update.mockResolvedValueOnce(ticket({ attempts: 2 }));
      expect(await redeem("000000")).toEqual({ ok: false, error: "BAD_CODE" });
      expect(emails.notifyWrongCode).not.toHaveBeenCalled();

      prisma.loginTicket.update.mockResolvedValueOnce(ticket({ attempts: 3 }));
      await redeem("000000");
      expect(prisma.loginTicket.update).toHaveBeenLastCalledWith({
        where: { id: "ticket-1" },
        data: { attempts: { increment: 1 } },
      });
      expect(emails.notifyWrongCode).toHaveBeenCalledTimes(1);
    });

    it("throws the ticket away after too many wrong codes", async () => {
      checkSecondFactor.mockResolvedValue({ ok: false, error: "BAD_CODE" });
      prisma.loginTicket.update.mockResolvedValue(ticket({ attempts: TICKET_MAX_ATTEMPTS }));
      await redeem("000000");
      expect(prisma.loginTicket.deleteMany).toHaveBeenCalledWith({ where: { id: "ticket-1" } });
    });

    it("passes on the rate limit without counting it on the ticket", async () => {
      checkSecondFactor.mockResolvedValue({
        ok: false,
        error: "RATE_LIMITED",
        retryAfterSeconds: 60,
      });
      expect(await redeem("123456")).toEqual({ ok: false, error: "RATE_LIMITED" });
      expect(prisma.loginTicket.update).not.toHaveBeenCalled();
    });

    it("skips the code when it was checked already (right after enabling 2FA)", async () => {
      prisma.loginTicket.findUnique.mockResolvedValue(
        ticket({ secondFactorDone: true, user: { ...user, twoFactorEnabledAt: new Date() } }),
      );
      expect((await redeem()).ok).toBe(true);
      expect(checkSecondFactor).not.toHaveBeenCalled();
    });
  });

  describe("devices", () => {
    it("updates a known browser quietly", async () => {
      await redeem();
      expect(prisma.knownDevice.update).toHaveBeenCalled();
      expect(emails.notifyNewDevice).not.toHaveBeenCalled();
    });

    it("emails about a new browser when the account has used others", async () => {
      prisma.knownDevice.findUnique.mockResolvedValue(null);
      prisma.knownDevice.findMany.mockResolvedValue([{ deviceHash: "old" }]);
      await redeem();
      expect(prisma.knownDevice.upsert).toHaveBeenCalled();
      expect(emails.notifyNewDevice).toHaveBeenCalledWith(
        expect.objectContaining({ id: "user-1" }),
        { device: "Chrome su Windows", place: "Milano, IT" },
      );
    });

    it("doesn't email for the very first browser", async () => {
      prisma.knownDevice.findUnique.mockResolvedValue(null);
      await redeem();
      expect(emails.notifyNewDevice).not.toHaveBeenCalled();
    });

    it("forgets the oldest browsers beyond the limit", async () => {
      prisma.knownDevice.findUnique.mockResolvedValue(null);
      prisma.knownDevice.findMany.mockResolvedValue(
        Array.from({ length: MAX_DEVICES }, (_, i) => ({ deviceHash: `d${i}` })),
      );
      await redeem();
      expect(prisma.knownDevice.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", deviceHash: { in: [`d${MAX_DEVICES - 1}`] } },
      });
    });
  });
});
