import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPact, deletePact, newRefereeLink, payFine, revokeRefereeLink } from "./actions";
import { hashShareToken } from "@/lib/family-file-tokens";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma, rateLimit } = vi.hoisted(() => {
  const prisma = {
    category: { findFirst: vi.fn() },
    goal: { findFirst: vi.fn(), updateMany: vi.fn() },
    transaction: { aggregate: vi.fn() },
    pact: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { prisma, rateLimit: vi.fn() };
});
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", currency: "EUR", user: { id: "user-1" } }),
}));
vi.mock("@/lib/rate-limit", () => ({
  RULES: { pacts: { limit: 10, windowSeconds: 86_400 } },
  rateLimit,
  formatRetryAfter: () => "un'ora",
}));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://fintrack.example" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const pact = {
  id: "p1",
  householdId: "space-1",
  userId: "user-1",
  categoryId: "cat-1",
  limit: 150,
  periodFrom: day("2026-09-01"),
  periodTo: day("2026-09-30"),
  onlyMine: true,
  refereeName: "Marco",
  fineAmount: 30,
  goalId: "goal-1",
  finePaidAt: null,
  category: { children: [{ id: "cat-2" }] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T10:00:00Z"));
  prisma.category.findFirst.mockResolvedValue({ id: "cat-1" });
  prisma.goal.findFirst.mockResolvedValue({ id: "goal-1" });
  prisma.pact.count.mockResolvedValue(0);
  prisma.pact.findFirst.mockResolvedValue(pact);
  prisma.pact.updateMany.mockResolvedValue({ count: 1 });
  prisma.pact.deleteMany.mockResolvedValue({ count: 1 });
  prisma.transaction.aggregate.mockResolvedValue({ _sum: { baseAmount: 182.5 } });
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  rateLimit.mockResolvedValue({ ok: true, remaining: 9, retryAfterSeconds: 0 });
});
afterEach(() => vi.useRealTimers());

describe("createPact", () => {
  const input = {
    categoryId: "cat-1",
    limit: "150",
    start: "next-month",
    onlyMine: true,
    refereeName: " Marco ",
    promise: "Offro la pizza a Marco",
    fineAmount: "30",
    goalId: "goal-1",
  };

  it("makes the pact for next month and gives back the referee's link once", async () => {
    const res = await createPact(input);
    expect(res.ok).toBe(true);
    const token = res.link!.split("/patto/arbitro/")[1];
    expect(res.link).toBe(`https://fintrack.example/patto/arbitro/${token}`);
    expect(prisma.pact.create).toHaveBeenCalledWith({
      data: {
        householdId: "space-1",
        userId: "user-1",
        categoryId: "cat-1",
        limit: 150,
        periodFrom: day("2026-11-01"),
        periodTo: day("2026-11-30"),
        onlyMine: true,
        refereeName: "Marco",
        refereeTokenHash: hashShareToken(token),
        promise: "Offro la pizza a Marco",
        fineAmount: 30,
        goalId: "goal-1",
      },
    });
  });

  it("starts today when asked, with no link without a referee", async () => {
    const res = await createPact({
      ...input,
      start: "now",
      refereeName: "",
      fineAmount: "",
      goalId: "",
    });
    expect(res).toEqual({ ok: true });
    expect(prisma.pact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        periodFrom: day("2026-10-08"),
        periodTo: day("2026-10-31"),
        refereeName: null,
        refereeTokenHash: null,
        fineAmount: null,
        goalId: null,
      }),
    });
  });

  it("wants a stake, and a goal for the fine", async () => {
    const none = await createPact({
      ...input,
      refereeName: "",
      promise: "",
      fineAmount: "",
      goalId: "",
    });
    expect(none.fieldErrors?.stake).toBeDefined();
    const noGoal = await createPact({ ...input, goalId: "" });
    expect(noGoal.fieldErrors?.goalId).toEqual(["Scegli dove va la multa"]);
    expect(prisma.pact.create).not.toHaveBeenCalled();
  });

  it("only uses categories and goals of the space", async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    expect((await createPact(input)).fieldErrors?.categoryId).toBeDefined();
    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: { id: "cat-1", householdId: "space-1", type: "EXPENSE" },
      select: { id: true },
    });
    prisma.category.findFirst.mockResolvedValue({ id: "cat-1" });
    prisma.goal.findFirst.mockResolvedValue(null);
    expect((await createPact(input)).fieldErrors?.goalId).toBeDefined();
    expect(prisma.pact.create).not.toHaveBeenCalled();
  });

  it("keeps it to three running pacts, and slows down after many", async () => {
    prisma.pact.count.mockResolvedValue(3);
    expect((await createPact(input)).error).toMatch(/3 patti in corso/);
    prisma.pact.count.mockResolvedValue(0);
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfterSeconds: 3600 });
    expect((await createPact(input)).error).toMatch(/riprova tra un'ora/);
    expect(prisma.pact.create).not.toHaveBeenCalled();
  });
});

describe("the referee's link", () => {
  it("makes a new one for the author's own pact", async () => {
    prisma.pact.findFirst.mockResolvedValue({ ...pact, periodTo: day("2026-10-31") });
    const res = await newRefereeLink("p1");
    expect(res.ok).toBe(true);
    expect(prisma.pact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1", householdId: "space-1", userId: "user-1" } }),
    );
    const token = res.link!.split("/patto/arbitro/")[1];
    expect(prisma.pact.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { refereeTokenHash: hashShareToken(token) },
    });
  });

  it("not a month after the end, nor for someone else's pact", async () => {
    prisma.pact.findFirst.mockResolvedValue({ ...pact, periodTo: day("2026-08-31") });
    expect((await newRefereeLink("p1")).ok).toBe(false);
    prisma.pact.findFirst.mockResolvedValue(null);
    expect(await newRefereeLink("p1")).toEqual({ ok: false, error: "Patto non trovato." });
    expect(prisma.pact.update).not.toHaveBeenCalled();
  });

  it("revokes and deletes only the author's pacts", async () => {
    expect(await revokeRefereeLink("p1")).toEqual({ ok: true });
    expect(prisma.pact.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", householdId: "space-1", userId: "user-1" },
      data: { refereeTokenHash: null },
    });
    expect(await deletePact("p1")).toEqual({ ok: true });
    expect(prisma.pact.deleteMany).toHaveBeenCalledWith({
      where: { id: "p1", householdId: "space-1", userId: "user-1" },
    });
    prisma.pact.deleteMany.mockResolvedValue({ count: 0 });
    expect((await deletePact("other")).ok).toBe(false);
  });
});

describe("payFine", () => {
  it("puts the fine of a lost pact in the goal, once", async () => {
    expect(await payFine("p1")).toEqual({ ok: true });
    expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
      where: {
        householdId: "space-1",
        type: "EXPENSE",
        categoryId: { in: ["cat-1", "cat-2"] },
        date: { gte: day("2026-09-01"), lte: day("2026-09-30") },
        userId: "user-1",
      },
      _sum: { baseAmount: true },
    });
    expect(prisma.pact.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", finePaidAt: null },
      data: { finePaidAt: new Date("2026-10-08T10:00:00Z") },
    });
    expect(prisma.goal.updateMany).toHaveBeenCalledWith({
      where: { id: "goal-1", householdId: "space-1" },
      data: { currentAmount: { increment: 30 } },
    });
  });

  it("does nothing for a pact kept, already paid or paid twice at once", async () => {
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { baseAmount: 120 } });
    expect((await payFine("p1")).error).toMatch(/non è perso/);
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { baseAmount: 182.5 } });
    prisma.pact.findFirst.mockResolvedValue({ ...pact, finePaidAt: new Date() });
    expect((await payFine("p1")).ok).toBe(false);
    prisma.pact.findFirst.mockResolvedValue(pact);
    prisma.pact.updateMany.mockResolvedValue({ count: 0 });
    expect((await payFine("p1")).ok).toBe(false);
    expect(prisma.goal.updateMany).not.toHaveBeenCalled();
  });
});
