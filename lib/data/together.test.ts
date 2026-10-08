import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTogether, personalSummary } from "./together";
import { pickShared, readShares } from "@/lib/finance/together";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma, accounts, investments } = vi.hoisted(() => ({
  prisma: {
    household: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
    householdMember: { findMany: vi.fn() },
    goal: { findMany: vi.fn() },
    transaction: { groupBy: vi.fn(), aggregate: vi.fn() },
  },
  accounts: vi.fn(),
  investments: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/data/accounts", () => ({ getAccountsWithBalances: accounts }));
vi.mock("@/lib/data/investments", () => ({ getInvestments: investments }));
vi.mock("@/lib/data/split", () => ({ PERSONAL_TAG: "personale" }));

const person = (id: string, name: string) => ({ name, email: `${id}@example.com` });

/**
 * Sara has a personal space, with money, savings, investments and goals; Demo's own space is
 * the shared one, so the database finds no space of Demo's alone.
 */
function saraHasAPersonalSpace(saraAlone = true) {
  prisma.household.findFirst.mockImplementation(({ where }: { where: { ownerId: string } }) =>
    Promise.resolve(where.ownerId === "sara" && saraAlone ? { id: "sara", currency: "EUR" } : null),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T10:00:00Z"));
  saraHasAPersonalSpace();
  prisma.household.findUniqueOrThrow.mockResolvedValue({ name: "Casa", currency: "EUR" });
  accounts.mockImplementation((id: string) =>
    Promise.resolve(
      id === "sara"
        ? [
            { type: "CHECKING", archived: false, baseBalance: 2400 },
            { type: "SAVINGS", archived: false, baseBalance: 6000 },
            { type: "INVESTMENT", archived: false, baseBalance: 9000 },
          ]
        : [{ type: "CHECKING", archived: false, baseBalance: 3100 }],
    ),
  );
  investments.mockResolvedValue({ total: { value: 9120.5 } });
  prisma.goal.findMany.mockImplementation(({ where }: { where: { householdId: string } }) =>
    Promise.resolve(
      where.householdId === "sara"
        ? [{ name: "Corso di fotografia", targetAmount: 800, currentAmount: 200 }]
        : [{ name: "Vacanza", targetAmount: 4000, currentAmount: 1000 }],
    ),
  );
  prisma.transaction.groupBy.mockResolvedValue([
    { type: "INCOME", _sum: { baseAmount: 1650 } },
    { type: "EXPENSE", _sum: { baseAmount: 1320 } },
  ]);
  prisma.transaction.aggregate.mockResolvedValue({ _sum: { baseAmount: 812.4 } });
});

describe("a personal space", () => {
  it("adds up money at hand, last month's savings, investments and goals", async () => {
    expect(await personalSummary("sara")).toEqual({
      currency: "EUR",
      balance: 8400,
      savings: { month: "settembre", saved: 330, rate: 0.2 },
      investments: 9120.5,
      goals: [{ name: "Corso di fotografia", progress: 0.25 }],
    });
  });

  it("is a space the user owns with no one else in it", async () => {
    await personalSummary("sara");
    expect(prisma.household.findFirst).toHaveBeenCalledWith({
      where: { ownerId: "sara", members: { every: { userId: "sara" } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, currency: true },
    });
  });

  it("is not personal once someone else is in it", async () => {
    saraHasAPersonalSpace(false);
    expect(await personalSummary("sara")).toBeNull();
    expect(await personalSummary("demo")).toBeNull();
    expect(accounts).not.toHaveBeenCalled();
  });
});

describe("what crosses over", () => {
  const members = (saraShares: string[]) => [
    { userId: "demo", shares: [], user: person("demo", "Demo Rossi") },
    { userId: "sara", shares: saraShares, user: person("sara", "Sara Bianchi") },
  ];

  it("shows nothing of Sara's space until she chooses, and doesn't even read it", async () => {
    prisma.householdMember.findMany.mockResolvedValue(members([]));
    const t = await getTogether("demo", "demo");
    expect(t.others).toEqual([{ name: "Sara", shares: [], summary: null }]);
    expect(prisma.household.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerId: "sara" }) }),
    );
    expect(accounts).not.toHaveBeenCalledWith("sara");
  });

  it("shows only the items Sara chose", async () => {
    prisma.householdMember.findMany.mockResolvedValue(members(["balance", "goals"]));
    const t = await getTogether("demo", "demo");
    expect(t.others[0].summary).toEqual({
      currency: "EUR",
      balance: 8400,
      savings: null,
      investments: null,
      goals: [{ name: "Corso di fotografia", progress: 0.25 }],
    });
  });

  it("ignores unknown items that might be stored", async () => {
    prisma.householdMember.findMany.mockResolvedValue(members(["movements", "transactions"]));
    const t = await getTogether("demo", "demo");
    expect(t.others[0]).toEqual({ name: "Sara", shares: [], summary: null });
  });

  it("gives Sara her own space in full, and the shared space's figures to both", async () => {
    prisma.householdMember.findMany.mockResolvedValue(members([]));
    const t = await getTogether("sara", "demo");
    expect(t.mine?.investments).toBe(9120.5);
    expect(t.myShares).toEqual([]);
    expect(t.ours).toMatchObject({ balance: 3100, spentThisMonth: 812.4 });
    // Demo's own space is the shared one: nothing personal of Demo's exists to show.
    expect(t.others).toEqual([{ name: "Demo", shares: [], summary: null }]);
  });

  it("only works for members of the space", async () => {
    prisma.householdMember.findMany.mockResolvedValue(members(["balance"]));
    await expect(getTogether("stranger", "demo")).rejects.toThrow();
  });
});

describe("the filter", () => {
  const full = {
    currency: "EUR",
    balance: 1,
    savings: { month: "settembre", saved: 2, rate: 0.1 },
    investments: 3,
    goals: [{ name: "x", progress: 0.5 }],
  };

  it("keeps known items only, once, in order", () => {
    expect(readShares(["goals", "balance", "balance", "hack"])).toEqual(["balance", "goals"]);
  });

  it("nulls everything not chosen", () => {
    expect(pickShared(full, [])).toEqual({
      currency: "EUR",
      balance: null,
      savings: null,
      investments: null,
      goals: null,
    });
    expect(pickShared(full, ["savings"]).savings).toEqual(full.savings);
    expect(pickShared(full, ["savings"]).balance).toBeNull();
  });
});
