import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPersonalSpace, setShares } from "./actions";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma } = vi.hoisted(() => ({
  prisma: {
    householdMember: { count: vi.fn(), updateMany: vi.fn() },
    household: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUniqueOrThrow: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", currency: "EUR", user: { id: "user-1" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/together", () => ({ soloSpace: () => prisma.household.findFirst() }));
// lib/households dedupes per request with React's cache, which only exists on the server.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

beforeEach(() => {
  vi.clearAllMocks();
  prisma.householdMember.count.mockResolvedValue(2);
  prisma.householdMember.updateMany.mockResolvedValue({ count: 1 });
  prisma.household.findFirst.mockResolvedValue(null);
  prisma.user.findUniqueOrThrow.mockResolvedValue({ name: "Demo Rossi", email: "demo@x.it" });
});

describe("setShares", () => {
  it("saves only the user's own choice, in this space, in the usual order", async () => {
    expect(await setShares(["goals", "balance", "goals"])).toEqual({ ok: true });
    expect(prisma.householdMember.updateMany).toHaveBeenCalledWith({
      where: { householdId: "space-1", userId: "user-1" },
      data: { shares: ["balance", "goals"] },
    });
  });

  it("stops showing everything with an empty choice", async () => {
    await setShares([]);
    expect(prisma.householdMember.updateMany).toHaveBeenCalledWith({
      where: { householdId: "space-1", userId: "user-1" },
      data: { shares: [] },
    });
  });

  it("refuses unknown items and solo spaces", async () => {
    expect((await setShares(["movements"])).ok).toBe(false);
    expect((await setShares("balance")).ok).toBe(false);
    prisma.householdMember.count.mockResolvedValue(1);
    expect((await setShares(["balance"])).ok).toBe(false);
    expect(prisma.householdMember.updateMany).not.toHaveBeenCalled();
  });
});

describe("createPersonalSpace", () => {
  it("gives a space of one's own to whoever has none", async () => {
    expect(await createPersonalSpace()).toEqual({ ok: true });
    expect(prisma.household.create).toHaveBeenCalledWith({
      data: {
        name: "Spazio di Demo",
        ownerId: "user-1",
        currency: "EUR",
        members: { create: { userId: "user-1", role: "OWNER" } },
      },
    });
  });

  it("not a second one", async () => {
    prisma.household.findFirst.mockResolvedValue({ id: "mine", currency: "EUR" });
    expect((await createPersonalSpace()).ok).toBe(false);
    expect(prisma.household.create).not.toHaveBeenCalled();
  });
});
