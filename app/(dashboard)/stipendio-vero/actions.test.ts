import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteBigExpense,
  markBigExpensePaid,
  saveBigExpense,
  saveTrueSalarySettings,
  setRecurringCounted,
  setTrueSalaryActive,
  undoBigExpensePaid,
} from "./actions";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma } = vi.hoisted(() => ({
  prisma: {
    bigExpense: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    financialAccount: { findFirst: vi.fn() },
    household: { update: vi.fn() },
    foundMoneyDismissal: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", currency: "EUR", user: { id: "user-1" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ours = (where: object) => expect.objectContaining({ where });
const imu = { preset: "imu", name: "IMU", amount: "412", months: [6, 12], day: "16" };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.bigExpense.updateMany.mockResolvedValue({ count: 1 });
  prisma.bigExpense.deleteMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.useRealTimers());

describe("big expenses belong to their space", () => {
  it("adds them to the active space", async () => {
    expect(await saveBigExpense(null, imu)).toEqual({ ok: true });
    expect(prisma.bigExpense.create).toHaveBeenCalledWith({
      data: {
        householdId: "space-1",
        preset: "imu",
        name: "IMU",
        amount: "412.00",
        months: [6, 12],
        day: 16,
      },
    });
  });

  it("never changes or deletes one of another space", async () => {
    prisma.bigExpense.updateMany.mockResolvedValue({ count: 0 });
    prisma.bigExpense.deleteMany.mockResolvedValue({ count: 0 });
    prisma.bigExpense.findFirst.mockResolvedValue(null);

    expect((await saveBigExpense("other", imu)).ok).toBe(false);
    expect(prisma.bigExpense.updateMany).toHaveBeenCalledWith(
      ours({ id: "other", householdId: "space-1" }),
    );
    expect((await deleteBigExpense("other")).ok).toBe(false);
    expect(prisma.bigExpense.deleteMany).toHaveBeenCalledWith(
      ours({ id: "other", householdId: "space-1" }),
    );
    expect((await markBigExpensePaid("other")).ok).toBe(false);
    expect(prisma.bigExpense.findFirst).toHaveBeenCalledWith(
      ours({ id: "other", householdId: "space-1" }),
    );
    expect((await undoBigExpensePaid("other")).ok).toBe(false);
  });

  it("forgets what was marked as paid when the dates change", async () => {
    await saveBigExpense("imu-1", { ...imu, months: [7, 12] });
    expect(prisma.bigExpense.updateMany).toHaveBeenCalledWith({
      where: { id: "imu-1", householdId: "space-1" },
      data: expect.objectContaining({ months: [7, 12], paidThrough: null }),
    });
  });

  it("rejects an invalid big expense", async () => {
    const res = await saveBigExpense(null, { ...imu, months: [] });
    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.months).toBeDefined();
    expect(prisma.bigExpense.create).not.toHaveBeenCalled();
  });
});

describe("markBigExpensePaid", () => {
  it("marks the next payment as paid", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
    prisma.bigExpense.findFirst.mockResolvedValue({
      id: "imu-1",
      amount: 412,
      months: [6, 12],
      day: 16,
      paidThrough: null,
    });
    expect(await markBigExpensePaid("imu-1")).toEqual({ ok: true });
    expect(prisma.bigExpense.updateMany).toHaveBeenCalledWith({
      where: { id: "imu-1", householdId: "space-1" },
      data: { paidThrough: new Date("2026-12-16T00:00:00.000Z") },
    });
  });
});

describe("saveTrueSalarySettings", () => {
  it("only takes a reserve account of the space, and not an investment", async () => {
    prisma.financialAccount.findFirst.mockResolvedValue(null);
    const res = await saveTrueSalarySettings({ reserveAccountId: "acc-x" });
    expect(res.fieldErrors?.reserveAccountId).toBeDefined();
    expect(prisma.financialAccount.findFirst).toHaveBeenCalledWith(
      ours({ id: "acc-x", householdId: "space-1" }),
    );

    prisma.financialAccount.findFirst.mockResolvedValue({ type: "INVESTMENT" });
    expect((await saveTrueSalarySettings({ reserveAccountId: "etf" })).ok).toBe(false);
    expect(prisma.household.update).not.toHaveBeenCalled();
  });

  it("saves payday, extra salaries and reserve account on the space", async () => {
    prisma.financialAccount.findFirst.mockResolvedValue({ type: "SAVINGS" });
    const res = await saveTrueSalarySettings({
      payday: "27",
      thirteenth: "1.650",
      fourteenth: "",
      reserveAccountId: "savings",
    });
    expect(res).toEqual({ ok: true });
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: "space-1" },
      data: {
        payday: 27,
        thirteenthSalary: "1650.00",
        fourteenthSalary: null,
        reserveAccountId: "savings",
      },
    });
  });
});

describe("dashboard and found charges", () => {
  it("turns the true salary on and off", async () => {
    await setTrueSalaryActive(true);
    expect(prisma.household.update).toHaveBeenLastCalledWith({
      where: { id: "space-1" },
      data: { trueSalarySince: expect.any(Date) },
    });
    await setTrueSalaryActive(false);
    expect(prisma.household.update).toHaveBeenLastCalledWith({
      where: { id: "space-1" },
      data: { trueSalarySince: null },
    });
    expect((await setTrueSalaryActive("yes")).ok).toBe(false);
  });

  it("stops counting a charge found among the movements, and counts it again", async () => {
    await setRecurringCounted("EXPENSE|acquedotto", false);
    expect(prisma.foundMoneyDismissal.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { householdId: "space-1", key: "salary:EXPENSE|acquedotto" },
      }),
    );
    await setRecurringCounted("EXPENSE|acquedotto", true);
    expect(prisma.foundMoneyDismissal.deleteMany).toHaveBeenCalledWith({
      where: { householdId: "space-1", key: "salary:EXPENSE|acquedotto" },
    });
  });
});
