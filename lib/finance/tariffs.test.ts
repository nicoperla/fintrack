import { describe, expect, it } from "vitest";
import {
  accountCosts,
  carContext,
  compareBankAccount,
  compareCar,
  compareElectricity,
  isProvince,
  positionText,
  PROVINCE_OPTIONS,
  referencePrice,
  shareBelow,
  upcomingRenewals,
  verdictFor,
} from "./tariffs";
import { CAR_PROVINCES } from "./tariff-data";

describe("verdict and position", () => {
  it("calls it in line within 10% of the reference", () => {
    expect(verdictFor(450, 412.1)).toBe("inline");
    expect(verdictFor(460, 412.1)).toBe("above");
    expect(verdictFor(360, 412.1)).toBe("below");
  });

  it("reads the share of people paying less from the percentiles", () => {
    const milano = { 5: 172.3, 10: 202, 25: 265, 50: 356.4, 75: 486, 95: 843.3, 99: 1347.3 };
    expect(shareBelow(486, milano)).toBe(75);
    expect(shareBelow(421.2, milano)).toBeCloseTo(62.5, 5);
    expect(shareBelow(100, milano)).toBe(5);
    expect(shareBelow(2000, milano)).toBe(99);
    // A flat stretch (many online accounts cost nothing) doesn't divide by zero.
    expect(shareBelow(0, { 10: 0, 25: 1, 50: 14 })).toBe(10);
  });

  it("says it in tenths, never 0 or 10 out of 10", () => {
    expect(positionText(76.9, "automobilisti")).toBe("Paghi più di 7 automobilisti su 10");
    expect(positionText(99, "automobilisti")).toBe("Paghi più di 9 automobilisti su 10");
    expect(positionText(5, "correntisti")).toBe("Paghi meno di 9 correntisti su 10");
    expect(positionText(50, "correntisti")).toBe("Paghi più di 5 correntisti su 10");
  });
});

describe("provinces", () => {
  it("has the 106 IVASS provinces, by name", () => {
    expect(PROVINCE_OPTIONS).toHaveLength(106);
    expect(PROVINCE_OPTIONS[0]).toEqual({ code: "AG", name: "Agrigento" });
    expect(isProvince("MI")).toBe(true);
    expect(isProvince("XX")).toBe(false);
    expect(isProvince("toString")).toBe(false);
  });

  it("matches the IVASS report: Napoli pays 255 € more than Aosta", () => {
    expect(Math.round(CAR_PROVINCES.NA.mean - CAR_PROVINCES.AO.mean)).toBe(255);
    for (const { p } of Object.values(CAR_PROVINCES)) {
      expect(p).toHaveLength(7);
      expect([...p].sort((a, b) => a - b)).toEqual(p);
    }
  });
});

describe("compareCar", () => {
  it("compares the premium with the province's average", () => {
    const result = compareCar({ premium: 520, province: "MI", bonusMalus: 1, ageBand: "45-59" });
    expect(result).toMatchObject({
      provinceName: "Milano",
      mean: 412.1,
      verdict: "above",
      over: 107.9,
      context: [],
    });
    expect(result!.share).toBeCloseTo(76.9, 1);
  });

  it("needs a known province", () => {
    expect(compareCar({ premium: 520, province: null, bonusMalus: null, ageBand: null })).toBe(
      null,
    );
    expect(compareCar({ premium: 520, province: "XX", bonusMalus: null, ageBand: null })).toBe(
      null,
    );
  });

  it("explains a higher premium with the class and the age", () => {
    expect(carContext(8, "fino-24")).toEqual([
      { reason: "class", group: "4-10", average: 613.2 },
      { reason: "age", group: "fino-24", average: 937.4 },
    ]);
    expect(carContext(1, "45-59")).toEqual([]);
    expect(carContext(null, null)).toEqual([]);
  });
});

describe("accountCosts", () => {
  const month = (m: number) => `2026-${String(m).padStart(2, "0")}-28`;
  const movements = [
    ...Array.from({ length: 9 }, (_, i) => ({
      date: month(i + 1),
      description: "CANONE MENSILE CONTO",
      amount: 7,
      category: null,
    })),
    { date: "2025-10-28", description: "Canone mensile conto", amount: 7, category: null },
    { date: "2025-11-28", description: "Canone mensile conto", amount: 7, category: null },
    { date: "2025-12-28", description: "Canone mensile conto", amount: 7, category: null },
    { date: "2025-09-01", description: "Canone mensile conto", amount: 7, category: null },
    { date: "2026-03-31", description: "Imposta di bollo", amount: 8.55, category: null },
    { date: "2026-06-30", description: "IMPOSTA DI BOLLO E/C", amount: 8.55, category: null },
    { date: "2026-02-10", description: "Commissione bonifico", amount: 1.5, category: null },
    { date: "2026-02-11", description: "Esselunga", amount: 64.2, category: "Spesa" },
  ];

  it("adds up the bank's fees of the last year, with the stamp duty apart", () => {
    expect(accountCosts(movements, "2026-10-07", "2025-01-01")).toEqual({
      yearly: 85.5,
      stampDuty: 17.1,
      count: 13,
      months: 12,
    });
  });

  it("stretches the complete months of a shorter history to a year", () => {
    const recent = [
      ...movements.filter((m) => m.date >= "2026-06-01"),
      // October is still going: its fee waits for the month to end.
      { date: "2026-10-05", description: "Canone mensile conto", amount: 7, category: null },
    ];
    // June to September: 4 fees of 7 € in 4 months.
    expect(accountCosts(recent, "2026-10-07", "2026-06-01")).toEqual({
      yearly: 84,
      stampDuty: 25.65,
      count: 4,
      months: 4,
    });
  });

  it("has nothing to say without a complete month", () => {
    expect(accountCosts(movements, "2026-10-07", "2026-09-15")).toEqual({
      yearly: 0,
      stampDuty: 0,
      count: 0,
      months: 0,
    });
  });
});

describe("compareBankAccount", () => {
  it("compares the year with the accounts of the same kind", () => {
    const result = compareBankAccount(140, "tradizionale");
    expect(result).toMatchObject({ mean: 101.1, verdict: "above", over: 38.9, overOnline: 109.4 });
    expect(result.share).toBeCloseTo(76.5, 1);
    expect(compareBankAccount(0, "online")).toMatchObject({ verdict: "below", share: 10, over: 0 });
  });
});

describe("electricity", () => {
  it("weighs ARERA's quarters by the days of the bill", () => {
    expect(referencePrice("2026-07-01", "2026-09-30")).toBe(0.3163);
    expect(referencePrice("2026-09-01", "2026-10-31")).toBe(0.3763);
    expect(referencePrice("2025-09-01", "2025-10-31")).toBeNull();
    expect(referencePrice("2027-01-01", "2027-01-31")).toBeNull();
  });

  it("turns a bill into a price per kWh and a year", () => {
    expect(
      compareElectricity({ amount: 115.5, kwh: 330, from: "2026-07-01", to: "2026-08-31" }),
    ).toEqual({
      price: 0.35,
      days: 62,
      yearlyKwh: 1943,
      yearlyCost: 679.96,
      reference: 0.3163,
      verdict: "above",
      over: 65.48,
      consumption: "typical",
    });
  });

  it("says when the consumption is far from the reference's 2,000 kWh", () => {
    const small = compareElectricity({
      amount: 50,
      kwh: 120,
      from: "2026-07-01",
      to: "2026-08-31",
    });
    expect(small.consumption).toBe("low");
    const old = compareElectricity({ amount: 50, kwh: 120, from: "2024-07-01", to: "2024-08-31" });
    expect(old).toMatchObject({ reference: null, verdict: null, over: 0 });
  });
});

describe("upcomingRenewals", () => {
  it("lists what ends within a month, soonest first", () => {
    const checks = [
      { id: "a", kind: "CAR_INSURANCE" as const, label: "Panda", renewsOn: "2026-10-27" },
      { id: "b", kind: "ELECTRICITY" as const, label: "Casa", renewsOn: "2026-10-10" },
      { id: "c", kind: "CAR_INSURANCE" as const, label: "Moto", renewsOn: "2026-11-20" },
      { id: "d", kind: "CAR_INSURANCE" as const, label: "Vecchia", renewsOn: "2026-10-01" },
      { id: "e", kind: "BANK_ACCOUNT" as const, label: "Conto", renewsOn: null },
    ];
    expect(upcomingRenewals(checks, "2026-10-07").map((r) => [r.id, r.days])).toEqual([
      ["b", 3],
      ["a", 20],
    ]);
  });
});
