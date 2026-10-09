import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteUser,
  grantPro,
  reactivateUser,
  resetUserTwoFactor,
  revokePro,
  suspendUser,
} from "./actions";

const { prisma, audit, confirmAdmin, redirect } = vi.hoisted(() => {
  const prisma = {
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    loginTicket: { deleteMany: vi.fn() },
    recoveryCode: { deleteMany: vi.fn() },
    household: { findMany: vi.fn(), update: vi.fn() },
    householdMember: { update: vi.fn() },
    claim: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    prisma,
    audit: vi.fn(),
    confirmAdmin: vi.fn(),
    redirect: vi.fn(() => {
      throw new Error("REDIRECT");
    }),
  };
});
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/audit", () => ({ audit }));
vi.mock("@/lib/auth/session", () => ({ requireAdmin: async () => ({ id: "admin-1" }) }));
vi.mock("@/lib/auth/step-up", () => ({ confirmAdmin }));
vi.mock("@/lib/config", () => ({
  emailConfigured: () => false,
  fintrackUrl: () => null,
  stripeConfigured: () => false,
}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(), escapeHtml: (s: string) => s }));
vi.mock("@/lib/stripe", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const anna = {
  id: "user-1",
  email: "anna@example.com",
  name: "Anna",
  plan: "FREE",
  subscriptionStatus: null as string | null,
  stripeCustomerId: null,
  suspendedAt: null,
  twoFactorEnabledAt: new Date(),
  emailVerifiedAt: new Date(),
};

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ ...anna });
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: typeof prisma) => unknown)(prisma)
      : Promise.resolve([]),
  );
  prisma.household.findMany.mockResolvedValue([]);
  confirmAdmin.mockResolvedValue(null);
});

describe("suspendUser", () => {
  it("needs a reason, then blocks and signs out the user", async () => {
    expect((await suspendUser("user-1", form({ reason: " " }))).ok).toBe(false);

    const result = await suspendUser("user-1", form({ reason: "Pagamenti contestati" }));
    expect(result.ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { suspendedAt: expect.any(Date), suspendedReason: "Pagamenti contestati" },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(prisma.loginTicket.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(audit).toHaveBeenCalledWith("admin-1", "user.suspended", {
      target: expect.objectContaining({ id: "user-1", email: "anna@example.com" }),
      details: { reason: "Pagamenti contestati" },
    });
  });

  it("reactivates", async () => {
    expect((await reactivateUser("user-1")).ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { suspendedAt: null, suspendedReason: null },
    });
  });

  it("answers for a user that doesn't exist", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await suspendUser("nope", form({ reason: "x" }))).toEqual({
      ok: false,
      error: "Utente non trovato.",
    });
  });
});

describe("grantPro / revokePro", () => {
  it("gives Pro until a date, as a gift", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
    expect((await grantPro("user-1", form({ days: "30" }))).ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        plan: "PRO",
        subscriptionStatus: "comp",
        planRenewsAt: new Date("2026-11-08T10:00:00Z"),
        planCancelsAtEnd: false,
      },
    });
    vi.useRealTimers();
  });

  it("never touches a paying subscriber, and checks the days", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...anna,
      plan: "PRO",
      subscriptionStatus: "active",
    });
    expect((await grantPro("user-1", form({ days: "30" }))).error).toMatch(/Stripe/);
    prisma.user.findUnique.mockResolvedValue({ ...anna });
    expect((await grantPro("user-1", form({ days: "9999" }))).ok).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("only takes back gifts", async () => {
    expect((await revokePro("user-1")).ok).toBe(false);
    prisma.user.findUnique.mockResolvedValue({ ...anna, plan: "PRO", subscriptionStatus: "comp" });
    expect((await revokePro("user-1")).ok).toBe(true);
  });
});

describe("resetUserTwoFactor", () => {
  it("needs the admin's own code", async () => {
    confirmAdmin.mockResolvedValue("Codice di verifica non valido.");
    expect((await resetUserTwoFactor("user-1", form({ code: "000000" }))).error).toMatch(/Codice/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("removes the secret and the codes and signs the user out", async () => {
    expect((await resetUserTwoFactor("user-1", form({ code: "123456" }))).ok).toBe(true);
    expect(confirmAdmin).toHaveBeenCalledWith("admin-1", { code: "123456" });
    expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(audit).toHaveBeenCalledWith("admin-1", "user.two_factor_reset", expect.anything());
  });
});

describe("deleteUser", () => {
  it("needs the user's email typed and the admin's code", async () => {
    expect((await deleteUser("user-1", form({ confirm: "altro@example.com", code: "1" }))).ok).toBe(
      false,
    );
    confirmAdmin.mockResolvedValueOnce("Codice di verifica non valido.");
    expect((await deleteUser("user-1", form({ confirm: "ANNA@example.com", code: "1" }))).ok).toBe(
      false,
    );
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("hands shared spaces over, then deletes and logs", async () => {
    prisma.household.findMany.mockResolvedValue([
      { id: "shared", members: [{ userId: "user-2" }] },
      { id: "personal", members: [] },
    ]);
    await expect(
      deleteUser("user-1", form({ confirm: "anna@example.com", code: "123456" })),
    ).rejects.toThrow("REDIRECT");
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: "shared" },
      data: { ownerId: "user-2" },
    });
    expect(prisma.household.update).toHaveBeenCalledTimes(1);
    expect(prisma.claim.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(audit).toHaveBeenCalledWith("admin-1", "user.deleted", expect.anything());
    expect(redirect).toHaveBeenCalledWith("/utenti?deleted=1");
  });
});
