import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteTariffCheck,
  saveBankAccount,
  saveCarInsurance,
  saveElectricityBill,
  saveTariffProfile,
  setTariffPool,
} from "./actions";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma } = vi.hoisted(() => ({
  prisma: {
    household: { update: vi.fn() },
    financialAccount: { findFirst: vi.fn() },
    tariffCheck: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", currency: "EUR", user: { id: "user-1" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
  prisma.tariffCheck.updateMany.mockResolvedValue({ count: 1 });
  prisma.tariffCheck.deleteMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.useRealTimers());

describe("saveTariffProfile", () => {
  it("saves the province and the household size on the space", async () => {
    expect(await saveTariffProfile({ province: "MI", householdSize: "3" })).toEqual({ ok: true });
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: "space-1" },
      data: { province: "MI", householdSize: 3 },
    });
  });

  it("accepts only the provinces it has prices for", async () => {
    const res = await saveTariffProfile({ province: "XX", householdSize: "" });
    expect(res.fieldErrors?.province).toBeDefined();
    expect(prisma.household.update).not.toHaveBeenCalled();
  });
});

describe("saveCarInsurance", () => {
  const car = {
    label: "Panda",
    premium: "480",
    renewsOn: "2027-03-01",
    bonusMalus: "1",
    ageBand: "45-59",
  };

  it("adds a policy to the space", async () => {
    expect(await saveCarInsurance(car)).toEqual({ ok: true });
    expect(prisma.tariffCheck.create).toHaveBeenCalledWith({
      data: {
        householdId: "space-1",
        kind: "CAR_INSURANCE",
        label: "Panda",
        amount: 480,
        renewsOn: day("2027-03-01"),
        bonusMalus: 1,
        ageBand: "45-59",
      },
    });
  });

  it("won't touch another space's policy", async () => {
    prisma.tariffCheck.findFirst.mockResolvedValue(null);
    const res = await saveCarInsurance({ ...car, id: "other" });
    expect(res.ok).toBe(false);
    expect(prisma.tariffCheck.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "other", householdId: "space-1", kind: "CAR_INSURANCE" },
      }),
    );
    expect(prisma.tariffCheck.updateMany).not.toHaveBeenCalled();
  });

  it("remembers last year's premium when the policy is renewed", async () => {
    prisma.tariffCheck.findFirst.mockResolvedValue({
      amount: 520,
      previousAmount: null,
      renewsOn: day("2026-03-01"),
    });
    await saveCarInsurance({ ...car, id: "c1", premium: "440" });
    expect(prisma.tariffCheck.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", householdId: "space-1" },
      data: expect.objectContaining({ amount: 440, previousAmount: 520 }),
    });

    // Fixing a typo in the same policy year keeps what was there.
    prisma.tariffCheck.findFirst.mockResolvedValue({
      amount: 440,
      previousAmount: 520,
      renewsOn: day("2027-03-01"),
    });
    await saveCarInsurance({ ...car, id: "c1", premium: "445" });
    expect(prisma.tariffCheck.updateMany).toHaveBeenLastCalledWith({
      where: { id: "c1", householdId: "space-1" },
      data: expect.objectContaining({ amount: 445, previousAmount: 520 }),
    });
  });

  it("asks for the premium", async () => {
    const res = await saveCarInsurance({ ...car, premium: "" });
    expect(res.fieldErrors?.premium).toBeDefined();
  });
});

describe("saveBankAccount", () => {
  it("works only on the space's own accounts", async () => {
    prisma.financialAccount.findFirst.mockResolvedValue(null);
    const res = await saveBankAccount({ accountId: "a9", accountKind: "online", yearly: "" });
    expect(res.ok).toBe(false);
    expect(prisma.financialAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a9", householdId: "space-1" } }),
    );
    expect(prisma.tariffCheck.upsert).not.toHaveBeenCalled();
  });

  it("keeps one check per account, named after it", async () => {
    prisma.financialAccount.findFirst.mockResolvedValue({ name: "Conto Intesa" });
    await saveBankAccount({ accountId: "a1", accountKind: "tradizionale", yearly: "96,50" });
    expect(prisma.tariffCheck.upsert).toHaveBeenCalledWith({
      where: { householdId_accountId: { householdId: "space-1", accountId: "a1" } },
      create: {
        householdId: "space-1",
        kind: "BANK_ACCOUNT",
        accountId: "a1",
        label: "Conto Intesa",
        accountKind: "tradizionale",
        amount: 96.5,
      },
      update: { label: "Conto Intesa", accountKind: "tradizionale", amount: 96.5 },
    });
  });
});

describe("saveElectricityBill", () => {
  const bill = {
    label: "Luce di casa",
    amount: "118,40",
    kwh: "330",
    periodFrom: "2026-07-01",
    periodTo: "2026-08-31",
    renewsOn: "",
  };

  it("saves the bill", async () => {
    expect(await saveElectricityBill(bill)).toEqual({ ok: true });
    expect(prisma.tariffCheck.create).toHaveBeenCalledWith({
      data: {
        householdId: "space-1",
        kind: "ELECTRICITY",
        label: "Luce di casa",
        amount: 118.4,
        kwh: 330,
        periodFrom: day("2026-07-01"),
        periodTo: day("2026-08-31"),
        renewsOn: null,
      },
    });
  });

  it("refuses periods in the future or backwards", async () => {
    expect((await saveElectricityBill({ ...bill, periodTo: "2026-10-31" })).fieldErrors).toEqual({
      periodTo: ["La bolletta riguarda giorni già passati"],
    });
    expect(
      (await saveElectricityBill({ ...bill, periodFrom: "2026-09-01" })).fieldErrors?.periodTo,
    ).toEqual(["Viene prima dell'inizio"]);
    expect(prisma.tariffCheck.create).not.toHaveBeenCalled();
  });

  it("updates only the space's own bills", async () => {
    prisma.tariffCheck.updateMany.mockResolvedValue({ count: 0 });
    expect((await saveElectricityBill({ ...bill, id: "other" })).ok).toBe(false);
    expect(prisma.tariffCheck.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "other", householdId: "space-1", kind: "ELECTRICITY" },
      }),
    );
  });
});

describe("deleting and the anonymous comparison", () => {
  it("deletes only within the space", async () => {
    expect(await deleteTariffCheck("c1")).toEqual({ ok: true });
    expect(prisma.tariffCheck.deleteMany).toHaveBeenCalledWith({
      where: { id: "c1", householdId: "space-1" },
    });
    prisma.tariffCheck.deleteMany.mockResolvedValue({ count: 0 });
    expect((await deleteTariffCheck("other")).ok).toBe(false);
  });

  it("records the consent with its date, and forgets it when withdrawn", async () => {
    await setTariffPool(true);
    expect(prisma.household.update).toHaveBeenLastCalledWith({
      where: { id: "space-1" },
      data: { tariffPoolSince: new Date("2026-10-07T10:00:00Z") },
    });
    await setTariffPool(false);
    expect(prisma.household.update).toHaveBeenLastCalledWith({
      where: { id: "space-1" },
      data: { tariffPoolSince: null },
    });
  });
});
