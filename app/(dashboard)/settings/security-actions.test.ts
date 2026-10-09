import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changePassword,
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateRecoveryCodes,
  signOutOtherDevices,
  startTwoFactorSetup,
} from "./security-actions";
import { open } from "@/lib/auth/secret-box";

const {
  prisma,
  rateLimit,
  verifyPassword,
  checkSecondFactor,
  passwordProblem,
  issueTicket,
  emails,
} = vi.hoisted(() => ({
  prisma: {
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    recoveryCode: { deleteMany: vi.fn(), createMany: vi.fn() },
    loginTicket: { deleteMany: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  rateLimit: vi.fn(),
  verifyPassword: vi.fn(),
  checkSecondFactor: vi.fn(),
  passwordProblem: vi.fn(),
  issueTicket: vi.fn(),
  emails: { notifyPasswordChanged: vi.fn(), notifyTwoFactor: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/rate-limit", () => ({
  RULES: { reauth: { limit: 10, windowSeconds: 900 } },
  rateLimit,
  formatRetryAfter: () => "15 minuti",
}));
vi.mock("@/lib/auth/password", () => ({
  hashPassword: async (p: string) => `hashed:${p}`,
  verifyPassword,
}));
vi.mock("@/lib/auth/two-factor", () => ({ checkSecondFactor }));
vi.mock("@/lib/auth/password-policy", () => ({ passwordProblem }));
vi.mock("@/lib/auth/login-ticket", () => ({
  issueTicket,
  currentDevice: () => ({ deviceHash: "device", label: "Chrome su Windows", place: null }),
}));
vi.mock("@/lib/auth/security-emails", () => emails);

const account = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  email: "anna@example.com",
  name: "Anna",
  passwordHash: "hash",
  twoFactorEnabledAt: null,
  totpSecret: null,
  totpLastStep: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
  prisma.user.findUniqueOrThrow.mockResolvedValue(account());
  prisma.$transaction.mockResolvedValue([]);
  rateLimit.mockResolvedValue({ ok: true, remaining: 9, retryAfterSeconds: 0 });
  verifyPassword.mockResolvedValue(true);
  checkSecondFactor.mockResolvedValue({ ok: true, method: "totp" });
  passwordProblem.mockResolvedValue(null);
  issueTicket.mockResolvedValue("fresh-ticket");
});

describe("startTwoFactorSetup", () => {
  it("asks for the password first", async () => {
    verifyPassword.mockResolvedValue(false);
    const result = await startTwoFactorSetup({ password: "sbagliata" });
    expect(result.fieldErrors?.password).toEqual(["Password non corretta"]);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(rateLimit).toHaveBeenCalledWith("reauth:user-1", expect.anything());
  });

  it("stops guessing the password from an open session", async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfterSeconds: 900 });
    expect((await startTwoFactorSetup({ password: "x" })).error).toMatch(/Troppi tentativi/);
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("stores the new secret encrypted and returns the QR code", async () => {
    const result = await startTwoFactorSetup({ password: "giusta" });
    expect(result.ok).toBe(true);
    expect(result.secret).toMatch(/^([A-Z2-7]{4} ){7}[A-Z2-7]{4}$/);
    expect(result.qr).toContain("<svg");
    expect(result.uri).toMatch(/^otpauth:\/\/totp\/FinTrack:anna%40example\.com\?secret=/);

    const stored = prisma.user.update.mock.calls[0][0].data.totpSecret;
    expect(stored).not.toContain(result.secret!.replace(/ /g, ""));
    expect(open(stored)).toBe(result.secret!.replace(/ /g, ""));
  });

  it("does nothing when 2FA is already on", async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(account({ twoFactorEnabledAt: new Date() }));
    expect((await startTwoFactorSetup({ password: "giusta" })).ok).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("confirmTwoFactorSetup", () => {
  beforeEach(() => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(account({ totpSecret: "v1.sealed" }));
  });

  it("turns 2FA on, gives ten recovery codes and a new session for this browser", async () => {
    const result = await confirmTwoFactorSetup({ code: "123 456" });
    expect(result.ok).toBe(true);
    expect(result.codes).toHaveLength(10);
    expect(result.ticket).toBe("fresh-ticket");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { twoFactorEnabledAt: expect.any(Date), sessionVersion: { increment: 1 } },
    });
    const rows = prisma.recoveryCode.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(10);
    // Only hashes are stored.
    for (const row of rows) expect(result.codes).not.toContain(row.codeHash);
    expect(issueTicket).toHaveBeenCalledWith("user-1", expect.anything(), {
      secondFactorDone: true,
    });
    expect(emails.notifyTwoFactor).toHaveBeenCalledWith(expect.anything(), true);
  });

  it("refuses a wrong code", async () => {
    checkSecondFactor.mockResolvedValue({ ok: false, error: "BAD_CODE" });
    const result = await confirmTwoFactorSetup({ code: "000000" });
    expect(result.fieldErrors?.code?.[0]).toMatch(/Codice non valido/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("only takes 6 digits (not a recovery code)", async () => {
    expect((await confirmTwoFactorSetup({ code: "k7m2p-x9qrt" })).fieldErrors?.code).toBeDefined();
    expect(checkSecondFactor).not.toHaveBeenCalled();
  });

  it("needs the setup to have started", async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(account());
    expect((await confirmTwoFactorSetup({ code: "123456" })).error).toMatch(/ricomincia/);
  });
});

describe("disableTwoFactor", () => {
  beforeEach(() => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(
      account({ twoFactorEnabledAt: new Date(), totpSecret: "v1.sealed" }),
    );
  });

  it("needs both the password and a code", async () => {
    checkSecondFactor.mockResolvedValue({ ok: false, error: "BAD_CODE" });
    const result = await disableTwoFactor({ password: "giusta", code: "000000" });
    expect(result.fieldErrors?.code).toEqual(["Codice non valido"]);
    expect(prisma.user.update).not.toHaveBeenCalled();

    verifyPassword.mockResolvedValue(false);
    expect(
      (await disableTwoFactor({ password: "x", code: "123456" })).fieldErrors?.password,
    ).toBeDefined();
  });

  it("removes the secret and the codes, and signs the other devices out", async () => {
    const result = await disableTwoFactor({ password: "giusta", code: "123456" });
    expect(result).toEqual({ ok: true, ticket: "fresh-ticket" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        totpSecret: null,
        twoFactorEnabledAt: null,
        totpLastStep: null,
        sessionVersion: { increment: 1 },
      },
    });
    expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(emails.notifyTwoFactor).toHaveBeenCalledWith(expect.anything(), false);
  });
});

describe("regenerateRecoveryCodes", () => {
  it("replaces the codes after password and code", async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(account({ twoFactorEnabledAt: new Date() }));
    const result = await regenerateRecoveryCodes({ password: "giusta", code: "123456" });
    expect(result.codes).toHaveLength(10);
    expect(prisma.recoveryCode.deleteMany).toHaveBeenCalled();
    expect(prisma.recoveryCode.createMany).toHaveBeenCalled();
  });
});

describe("changePassword", () => {
  const input = {
    current: "vecchia password",
    password: "treno lento sul lago",
    confirmPassword: "treno lento sul lago",
  };

  it("checks the current password", async () => {
    verifyPassword.mockResolvedValue(false);
    expect((await changePassword(input)).fieldErrors?.current).toEqual(["Password non corretta"]);
  });

  it("asks for the code when 2FA is on", async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(account({ twoFactorEnabledAt: new Date() }));
    expect((await changePassword(input)).fieldErrors?.code).toEqual(["Inserisci il codice"]);
    expect((await changePassword({ ...input, code: "123456" })).ok).toBe(true);
  });

  it("refuses the same password and weak ones", async () => {
    expect(
      (await changePassword({ ...input, password: input.current, confirmPassword: input.current }))
        .fieldErrors?.password,
    ).toBeDefined();
    passwordProblem.mockResolvedValue("Troppo prevedibile");
    expect((await changePassword(input)).fieldErrors?.password).toEqual(["Troppo prevedibile"]);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("saves it, signs the other devices out and keeps this one in", async () => {
    expect(await changePassword(input)).toEqual({ ok: true, ticket: "fresh-ticket" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "hashed:treno lento sul lago", sessionVersion: { increment: 1 } },
    });
    expect(emails.notifyPasswordChanged).toHaveBeenCalled();
  });
});

describe("signOutOtherDevices", () => {
  it("raises the session version and renews this browser's session", async () => {
    expect(await signOutOtherDevices()).toEqual({ ok: true, ticket: "fresh-ticket" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { sessionVersion: { increment: 1 } },
    });
  });
});
