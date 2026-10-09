import { beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "./actions";

const { prisma, rateLimit, verifyPassword, checkAdminCode, startSession, audit, redirect } =
  vi.hoisted(() => ({
    prisma: { adminUser: { findUnique: vi.fn(), update: vi.fn() } },
    rateLimit: vi.fn(),
    verifyPassword: vi.fn(),
    checkAdminCode: vi.fn(),
    startSession: vi.fn(),
    audit: vi.fn(),
    redirect: vi.fn(() => {
      throw new Error("REDIRECT");
    }),
  }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/rate-limit", () => ({
  RULES: { loginIp: {}, loginEmail: {} },
  rateLimit,
  waitText: () => "15 minuti",
}));
vi.mock("@/lib/request", () => ({ clientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/auth/secrets", () => ({ DUMMY_HASH: "dummy", verifyPassword }));
vi.mock("@/lib/auth/second-factor", () => ({ checkAdminCode }));
vi.mock("@/lib/auth/session", () => ({ startSession, endSession: vi.fn(), getAdmin: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit }));
vi.mock("next/navigation", () => ({ redirect }));

const admin = {
  id: "admin-1",
  email: "boss@example.com",
  passwordHash: "hash",
  sessionVersion: 4,
  activatedAt: new Date(),
};
const input = { email: " Boss@Example.com ", password: "una password lunga", code: "123456" };

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  prisma.adminUser.findUnique.mockResolvedValue(admin);
  verifyPassword.mockResolvedValue(true);
  checkAdminCode.mockResolvedValue(true);
});

describe("admin login", () => {
  it("signs in with email, password and code, and logs it", async () => {
    await expect(login(input)).rejects.toThrow("REDIRECT");
    expect(prisma.adminUser.findUnique).toHaveBeenCalledWith({
      where: { email: "boss@example.com" },
    });
    expect(startSession).toHaveBeenCalledWith("admin-1", 4);
    expect(audit).toHaveBeenCalledWith("admin-1", "admin.login");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("gives the same answer for wrong password, wrong code and unknown email", async () => {
    verifyPassword.mockResolvedValueOnce(false);
    const wrongPassword = await login(input);
    checkAdminCode.mockResolvedValueOnce(false);
    const wrongCode = await login(input);
    prisma.adminUser.findUnique.mockResolvedValueOnce(null);
    const unknown = await login(input);
    expect(wrongPassword).toEqual({ ok: false, error: "Credenziali o codice non validi." });
    expect(wrongCode).toEqual(wrongPassword);
    expect(unknown).toEqual(wrongPassword);
    expect(verifyPassword).toHaveBeenLastCalledWith("una password lunga", "dummy");
    expect(startSession).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(null, "admin.login_failed", {
      details: { email: "boss@example.com" },
    });
  });

  it("doesn't check the code when the password is wrong", async () => {
    verifyPassword.mockResolvedValueOnce(false);
    await login(input);
    expect(checkAdminCode).not.toHaveBeenCalled();
  });

  it("refuses an admin whose setup isn't finished", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({ ...admin, activatedAt: null });
    expect((await login(input)).ok).toBe(false);
    expect(startSession).not.toHaveBeenCalled();
  });

  it("stops after too many attempts, before checking anything", async () => {
    rateLimit.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 600 });
    expect((await login(input)).error).toMatch(/Troppi tentativi/);
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(rateLimit).toHaveBeenCalledWith("login:ip:203.0.113.7", expect.anything());
  });
});
