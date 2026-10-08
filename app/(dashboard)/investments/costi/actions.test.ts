import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteFundCosts, saveFundCosts } from "./actions";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma } = vi.hoisted(() => ({
  prisma: {
    financialAccount: { findFirst: vi.fn() },
    investmentCost: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", currency: "EUR", user: { id: "user-1" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const input = {
  accountId: "acc-1",
  category: "equity",
  entry: "2",
  exit: "",
  ongoing: "1,85%",
  transaction: "0,075",
  performance: "",
  monthly: "200",
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.financialAccount.findFirst.mockResolvedValue({ id: "acc-1" });
  prisma.investmentCost.deleteMany.mockResolvedValue({ count: 1 });
});

describe("saveFundCosts", () => {
  it("saves the KID's percentages on an investment account of the space", async () => {
    expect(await saveFundCosts(input)).toEqual({ ok: true });
    expect(prisma.financialAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "acc-1", householdId: "space-1", type: "INVESTMENT" },
      select: { id: true },
    });
    const data = {
      category: "equity",
      entryPct: 2,
      exitPct: 0,
      ongoingPct: 1.85,
      transactionPct: 0.075,
      performancePct: 0,
      monthly: 200,
    };
    expect(prisma.investmentCost.upsert).toHaveBeenCalledWith({
      where: { accountId: "acc-1" },
      create: { accountId: "acc-1", householdId: "space-1", ...data },
      update: data,
    });
  });

  it("needs the ongoing costs and sensible percentages", async () => {
    expect((await saveFundCosts({ ...input, ongoing: "" })).fieldErrors?.ongoing).toBeDefined();
    expect((await saveFundCosts({ ...input, ongoing: "15" })).fieldErrors?.ongoing).toBeDefined();
    expect((await saveFundCosts({ ...input, entry: "due" })).fieldErrors?.entry).toBeDefined();
    expect(
      (await saveFundCosts({ ...input, category: "crypto" })).fieldErrors?.category,
    ).toBeDefined();
    expect(prisma.investmentCost.upsert).not.toHaveBeenCalled();
  });

  it("only on the space's investment accounts", async () => {
    prisma.financialAccount.findFirst.mockResolvedValue(null);
    expect((await saveFundCosts(input)).ok).toBe(false);
    expect(prisma.investmentCost.upsert).not.toHaveBeenCalled();
  });
});

describe("deleteFundCosts", () => {
  it("deletes within the space only", async () => {
    expect(await deleteFundCosts("acc-1")).toEqual({ ok: true });
    expect(prisma.investmentCost.deleteMany).toHaveBeenCalledWith({
      where: { accountId: "acc-1", householdId: "space-1" },
    });
    prisma.investmentCost.deleteMany.mockResolvedValue({ count: 0 });
    expect((await deleteFundCosts("other")).ok).toBe(false);
  });
});
