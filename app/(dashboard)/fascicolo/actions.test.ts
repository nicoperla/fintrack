import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFamilyShare, revokeFamilyShare, saveFamilyNotes } from "./actions";
import { hashShareToken } from "@/lib/family-file-tokens";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma, space, limiter } = vi.hoisted(() => ({
  prisma: {
    user: { findUniqueOrThrow: vi.fn() },
    familyFile: { upsert: vi.fn() },
    familyFileShare: { count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  },
  space: { role: "OWNER" as "OWNER" | "MEMBER" },
  limiter: { ok: true },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", role: space.role, user: { id: "user-1" } }),
}));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://fintrack.example" }));
vi.mock("@/lib/rate-limit", () => ({
  RULES: { familyShares: { limit: 10, windowSeconds: 86_400 } },
  rateLimit: async () => ({ ok: limiter.ok, remaining: 0, retryAfterSeconds: 3600 }),
  formatRetryAfter: () => "un'ora",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const share = { label: "Marco, mio fratello", days: "30", showAmounts: false };

beforeEach(() => {
  vi.clearAllMocks();
  space.role = "OWNER";
  limiter.ok = true;
  prisma.user.findUniqueOrThrow.mockResolvedValue({ plan: "FREE" });
  prisma.familyFileShare.count.mockResolvedValue(0);
  prisma.familyFileShare.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.unstubAllEnvs());

describe("saveFamilyNotes", () => {
  it("saves the notes of the active space", async () => {
    expect(await saveFamilyNotes({ documenti: "  Nel cassetto  ", contatti: "" })).toEqual({
      ok: true,
    });
    expect(prisma.familyFile.upsert).toHaveBeenCalledWith({
      where: { householdId: "space-1" },
      create: {
        householdId: "space-1",
        notes: { documenti: "Nel cassetto", contatti: "", polizze: "", istruzioni: "" },
      },
      update: { notes: { documenti: "Nel cassetto", contatti: "", polizze: "", istruzioni: "" } },
    });
  });

  it("rejects notes that are too long", async () => {
    const res = await saveFamilyNotes({ documenti: "x".repeat(3001) });
    expect(res.fieldErrors?.documenti).toBeDefined();
    expect(prisma.familyFile.upsert).not.toHaveBeenCalled();
  });
});

describe("createFamilyShare", () => {
  it("gives the link once and stores only the hash of its token", async () => {
    const before = Date.now();
    const res = await createFamilyShare(share);
    expect(res.ok).toBe(true);
    const token = res.link!.replace("https://fintrack.example/fascicolo/condiviso/", "");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const data = prisma.familyFileShare.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      householdId: "space-1",
      tokenHash: hashShareToken(token),
      label: "Marco, mio fratello",
      showAmounts: false,
    });
    expect(JSON.stringify(data)).not.toContain(token);
    const days = (data.expiresAt.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(29.99);
    expect(days).toBeLessThan(30.01);
  });

  it("is only for the owner of the space", async () => {
    space.role = "MEMBER";
    expect((await createFamilyShare(share)).ok).toBe(false);
    expect(prisma.familyFileShare.create).not.toHaveBeenCalled();
  });

  it("is part of Pro when payments are on", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    vi.stubEnv("STRIPE_PRICE_ID", "price_fake");
    expect((await createFamilyShare(share)).error).toContain("Pro");
    prisma.user.findUniqueOrThrow.mockResolvedValue({ plan: "PRO" });
    expect((await createFamilyShare(share)).ok).toBe(true);
  });

  it("keeps a limit on links alive and on requests", async () => {
    prisma.familyFileShare.count.mockResolvedValue(5);
    expect((await createFamilyShare(share)).error).toContain("revocane uno");
    prisma.familyFileShare.count.mockResolvedValue(0);
    limiter.ok = false;
    expect((await createFamilyShare(share)).error).toContain("un'ora");
    expect(prisma.familyFileShare.create).not.toHaveBeenCalled();
  });

  it("rejects an unnamed link or an odd duration", async () => {
    expect((await createFamilyShare({ ...share, label: " " })).fieldErrors?.label).toBeDefined();
    expect((await createFamilyShare({ ...share, days: "365" })).fieldErrors?.days).toBeDefined();
  });
});

describe("revokeFamilyShare", () => {
  it("revokes only links of the space", async () => {
    prisma.familyFileShare.updateMany.mockResolvedValue({ count: 0 });
    expect((await revokeFamilyShare("share-x")).ok).toBe(false);
    expect(prisma.familyFileShare.updateMany).toHaveBeenCalledWith({
      where: { id: "share-x", householdId: "space-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
