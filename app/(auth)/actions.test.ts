import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerUser, resetPassword, startLogin } from "./actions";

const { prisma, rateLimit, verifyPassword, passwordProblem, issueTicket, notifyPasswordChanged } =
  vi.hoisted(() => ({
    prisma: {
      user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
      passwordResetToken: { findUnique: vi.fn(), deleteMany: vi.fn() },
      loginTicket: { deleteMany: vi.fn() },
      $transaction: vi.fn(),
    },
    rateLimit: vi.fn(),
    verifyPassword: vi.fn(),
    passwordProblem: vi.fn(),
    issueTicket: vi.fn(),
    notifyPasswordChanged: vi.fn(),
  }));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/rate-limit", () => ({
  RULES: {
    loginEmail: { limit: 8, windowSeconds: 900 },
    loginIp: { limit: 30, windowSeconds: 900 },
    register: { limit: 5, windowSeconds: 3600 },
    resetSubmit: { limit: 10, windowSeconds: 3600 },
  },
  rateLimit,
  clientIp: () => "203.0.113.7",
  formatRetryAfter: () => "10 minuti",
}));
vi.mock("@/lib/auth/password", () => ({
  DUMMY_HASH: "dummy",
  hashPassword: async (p: string) => `hashed:${p}`,
  verifyPassword,
}));
vi.mock("@/lib/auth/password-policy", () => ({ passwordProblem }));
vi.mock("@/lib/auth/login-ticket", () => ({
  issueTicket,
  currentDevice: () => ({ deviceHash: "device", label: "Chrome su Windows", place: null }),
}));
vi.mock("@/lib/auth/security-emails", () => ({ notifyPasswordChanged }));
vi.mock("@/lib/auth/email-verification", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/households", () => ({ ensurePersonalHousehold: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://fintrack.example" }));

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, remaining: 5, retryAfterSeconds: 0 });
  verifyPassword.mockResolvedValue(true);
  passwordProblem.mockResolvedValue(null);
  issueTicket.mockResolvedValue("ticket-abc");
  prisma.user.findUnique.mockResolvedValue({
    id: "user-1",
    passwordHash: "hash",
    twoFactorEnabledAt: null,
  });
  prisma.$transaction.mockResolvedValue([]);
});

describe("startLogin", () => {
  const input = { email: " Anna@Example.com ", password: "una password lunga" };

  it("gives a ticket when the password is right", async () => {
    expect(await startLogin(input)).toEqual({ ok: true, ticket: "ticket-abc", needsCode: false });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "anna@example.com" } }),
    );
    expect(issueTicket).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ deviceHash: "device" }),
    );
  });

  it("says when the 2FA code is needed", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "hash",
      twoFactorEnabledAt: new Date(),
    });
    expect(await startLogin(input)).toMatchObject({ ok: true, needsCode: true });
  });

  it("answers the same for a wrong password and an unknown email", async () => {
    verifyPassword.mockResolvedValue(false);
    const wrong = await startLogin(input);
    prisma.user.findUnique.mockResolvedValue(null);
    const unknown = await startLogin(input);
    expect(wrong).toEqual({ ok: false, error: "Email o password non corretti." });
    expect(unknown).toEqual(wrong);
    // The unknown email still costs a bcrypt comparison, against the dummy hash.
    expect(verifyPassword).toHaveBeenLastCalledWith("una password lunga", "dummy");
    expect(issueTicket).not.toHaveBeenCalled();
  });

  it("stops before checking the password when there were too many tries", async () => {
    rateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfterSeconds: 600 });
    const result = await startLogin(input);
    expect(result).toEqual({
      ok: false,
      error: "Troppi tentativi di accesso. Riprova tra 10 minuti.",
    });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(rateLimit).toHaveBeenCalledWith("login:email:anna@example.com", expect.anything());
    expect(rateLimit).toHaveBeenCalledWith("login:ip:203.0.113.7", expect.anything());
  });
});

describe("registerUser", () => {
  const input = {
    name: "Anna",
    email: "anna@example.com",
    password: "treno lento sul lago",
    acceptTerms: true,
  };

  it("creates the account and signs in with a ticket", async () => {
    prisma.user.create.mockResolvedValue({ id: "user-9", email: "anna@example.com", name: "Anna" });
    expect(await registerUser(input)).toEqual({ ok: true, ticket: "ticket-abc" });
    expect(prisma.user.create.mock.calls[0][0].data.passwordHash).toBe(
      "hashed:treno lento sul lago",
    );
  });

  it("refuses passwords shorter than 10 characters", async () => {
    const result = await registerUser({ ...input, password: "corta123" });
    expect(result.fieldErrors?.password?.[0]).toMatch(/10 caratteri/);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("refuses weak or leaked passwords", async () => {
    passwordProblem.mockResolvedValue("Questa password è già comparsa in un furto di dati online");
    const result = await registerUser(input);
    expect(result.fieldErrors?.password?.[0]).toMatch(/furto di dati/);
    expect(passwordProblem).toHaveBeenCalledWith("treno lento sul lago", {
      email: "anna@example.com",
      name: "Anna",
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  const input = {
    token: "token",
    password: "treno lento sul lago",
    confirmPassword: "treno lento sul lago",
  };

  beforeEach(() => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ email: "anna@example.com", name: "Anna" });
  });

  it("changes the password, signs out every session and tells the owner", async () => {
    expect(await resetPassword(input)).toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "hashed:treno lento sul lago", sessionVersion: { increment: 1 } },
    });
    expect(prisma.loginTicket.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(notifyPasswordChanged).toHaveBeenCalledWith({ email: "anna@example.com", name: "Anna" });
  });

  it("refuses an expired link", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: "user-1",
      expiresAt: new Date(0),
    });
    expect((await resetPassword(input)).error).toMatch(/scaduto/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("applies the password rules", async () => {
    passwordProblem.mockResolvedValue("Non usare la tua email o il nome dell'app nella password");
    expect((await resetPassword(input)).fieldErrors?.password).toHaveLength(1);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
