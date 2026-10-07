import { describe, expect, it } from "vitest";
import {
  BIG_EXPENSE_PRESETS,
  accruedExtraSalary,
  computeTrueSalary,
  dayOfMonth,
  fixedUntil,
  lastYearAmount,
  nextPayday,
  nextPayment,
  paymentDates,
  presetByKey,
  reserveForBigExpense,
  reserveForRecurring,
  yearAhead,
  type BigExpenseInput,
  type RecurringForSalary,
} from "./true-salary";

const TODAY = "2026-10-07";
const PAYDAY = "2026-10-27";

const imu: BigExpenseInput = {
  id: "imu",
  name: "IMU",
  amount: 412,
  months: [6, 12],
  day: 16,
  paidThrough: null,
};
const gifts: BigExpenseInput = {
  id: "regali",
  name: "Regali di Natale",
  amount: 300,
  months: [12],
  day: 1,
  paidThrough: null,
};

const monthly = (
  name: string,
  amount: number,
  nextDate: string,
  type: "INCOME" | "EXPENSE" = "EXPENSE",
): RecurringForSalary => ({
  key: `${type}|${name.toLowerCase()}`,
  name,
  type,
  amount,
  nextDate,
  frequency: "monthly",
});

describe("dates of the big expenses", () => {
  it("uses the month's last day when it's shorter", () => {
    expect(dayOfMonth(2026, 2, 30)).toBe("2026-02-28");
    expect(dayOfMonth(2028, 2, 30)).toBe("2028-02-29");
    expect(dayOfMonth(2026, 11, 31)).toBe("2026-11-30");
  });

  it("lists every payment in a range", () => {
    expect(paymentDates(imu, "2026-01-01", "2027-06-30")).toEqual([
      "2026-06-16",
      "2026-12-16",
      "2027-06-16",
    ]);
  });

  it("finds the next payment and the previous one", () => {
    expect(nextPayment(imu, TODAY)).toEqual({ date: "2026-12-16", previous: "2026-06-16" });
    // Due today: still to pay.
    expect(nextPayment(imu, "2026-12-16")).toEqual({ date: "2026-12-16", previous: "2026-06-16" });
    expect(nextPayment(imu, "2026-12-17")).toEqual({ date: "2027-06-16", previous: "2026-12-16" });
  });

  it("skips a payment already marked as paid", () => {
    expect(nextPayment({ ...imu, paidThrough: "2026-12-16" }, TODAY)).toEqual({
      date: "2027-06-16",
      previous: "2026-12-16",
    });
  });
});

describe("reserveForBigExpense", () => {
  it("sets aside the part of the payment matured since the previous one", () => {
    // 206 € due on 16 December; 113 of the 183 days since 16 June have passed.
    expect(reserveForBigExpense(imu, TODAY, PAYDAY)).toMatchObject({
      nextDate: "2026-12-16",
      nextAmount: 206,
      reserved: 127.2,
      beforePayday: false,
    });
    // 310 of the 365 days since last 1 December.
    expect(reserveForBigExpense(gifts, TODAY, PAYDAY)?.reserved).toBe(254.79);
  });

  it("keeps it all when it's due before the salary", () => {
    expect(reserveForBigExpense(imu, "2026-12-10", "2026-12-27")).toMatchObject({
      reserved: 206,
      beforePayday: true,
    });
  });

  it("holds nothing for a payment already made", () => {
    expect(
      reserveForBigExpense({ ...imu, paidThrough: "2026-12-16" }, TODAY, PAYDAY),
    ).toMatchObject({ nextDate: "2027-06-16", reserved: 0 });
  });

  it("ignores an expense with no months or no amount", () => {
    expect(reserveForBigExpense({ ...imu, months: [] }, TODAY, PAYDAY)).toBeNull();
    expect(reserveForBigExpense({ ...imu, amount: 0 }, TODAY, PAYDAY)).toBeNull();
  });
});

describe("reserveForRecurring", () => {
  const water = {
    key: "EXPENSE|acquedotto",
    name: "Acquedotto",
    amount: 90,
    nextDate: "2026-12-20",
    frequency: "quarterly" as const,
  };

  it("accrues over the quarter", () => {
    // 17 of the 91 days since 20 September.
    expect(reserveForRecurring(water, TODAY, PAYDAY)).toMatchObject({
      nextDate: "2026-12-20",
      reserved: 16.81,
      beforePayday: false,
    });
  });

  it("keeps a bill a few days late in full, as due today", () => {
    expect(reserveForRecurring({ ...water, nextDate: "2026-10-04" }, TODAY, PAYDAY)).toMatchObject({
      nextDate: TODAY,
      reserved: 90,
      beforePayday: true,
    });
  });

  it("moves a long-missed bill to its next date", () => {
    expect(reserveForRecurring({ ...water, nextDate: "2026-09-01" }, TODAY, PAYDAY)).toMatchObject({
      nextDate: "2026-12-01",
      reserved: 35.6,
    });
  });
});

describe("accruedExtraSalary", () => {
  it("counts the tredicesima earned since last December", () => {
    // 296 of the 365 days since 15 December 2025.
    expect(accruedExtraSalary(1800, { month: 12, day: 15 }, TODAY)).toBe(1459.73);
  });

  it("is zero without an amount", () => {
    expect(accruedExtraSalary(null, { month: 12, day: 15 }, TODAY)).toBe(0);
  });
});

describe("nextPayday", () => {
  it("uses the day set by the user", () => {
    expect(nextPayday({ today: TODAY, day: 27, salary: null })).toEqual({
      date: PAYDAY,
      source: "manual",
      name: null,
    });
    // Paid today: the next one is next month's.
    expect(nextPayday({ today: "2026-10-27", day: 27, salary: null }).date).toBe("2026-11-27");
    expect(nextPayday({ today: "2026-11-05", day: 31, salary: null }).date).toBe("2026-11-30");
    expect(nextPayday({ today: "2026-12-29", day: 27, salary: null }).date).toBe("2027-01-27");
  });

  it("otherwise follows the recorded salary", () => {
    const salary = { name: "Stipendio Acme", nextDate: PAYDAY, frequency: "monthly" as const };
    expect(nextPayday({ today: TODAY, day: null, salary })).toEqual({
      date: PAYDAY,
      source: "salary",
      name: "Stipendio Acme",
    });
    // Late and not recorded: it isn't in the balance yet, so plan until the next one.
    expect(nextPayday({ today: "2026-10-28", day: null, salary }).date).toBe("2026-11-27");
  });

  it("falls back to the end of the month", () => {
    expect(nextPayday({ today: "2026-12-10", day: null, salary: null })).toEqual({
      date: "2027-01-01",
      source: "month-end",
      name: null,
    });
  });
});

describe("fixedUntil", () => {
  it("lists the monthly bills due before the salary", () => {
    const items = fixedUntil(
      [
        monthly("Netflix", 13.99, "2026-10-15"),
        monthly("Affitto", 750, "2026-11-01"),
        // Expected four days ago and not recorded yet: still coming, counted today.
        monthly("Gas", 40, "2026-10-03"),
        // Its October date is past the grace days: the next one comes after the salary.
        monthly("Palestra", 45, "2026-09-01"),
        monthly("Stipendio", 2500, "2026-10-27", "INCOME"),
        { ...monthly("Acquedotto", 90, "2026-10-20"), frequency: "quarterly" },
      ],
      TODAY,
      PAYDAY,
    );
    expect(items).toEqual([
      { name: "Gas", date: TODAY, amount: 40 },
      { name: "Netflix", date: "2026-10-15", amount: 13.99 },
    ]);
  });

  it("counts a weekly expense every week", () => {
    const items = fixedUntil(
      [{ ...monthly("Lezioni", 20, "2026-10-09"), frequency: "weekly" }],
      TODAY,
      PAYDAY,
    );
    expect(items.map((i) => i.date)).toEqual(["2026-10-09", "2026-10-16", "2026-10-23"]);
  });
});

describe("computeTrueSalary", () => {
  const base = {
    today: TODAY,
    payday: { date: PAYDAY, source: "salary" as const, name: "Stipendio" },
    everyday: [
      { name: "Conto corrente", balance: 1950 },
      { name: "Contanti", balance: 50 },
    ],
    recurring: [monthly("Netflix", 13.99, "2026-10-15"), monthly("Gas", 40, "2026-10-03")],
    bigExpenses: [imu, gifts],
    extraSalaries: { thirteenth: null, fourteenth: null },
    reserveAccount: null,
  };

  it("takes the fixed expenses and the matured big expenses out of the everyday money", () => {
    const result = computeTrueSalary(base);
    expect(result.everyday.total).toBe(2000);
    expect(result.fixed.total).toBe(53.99);
    expect(result.reserve).toMatchObject({
      reserved: 381.99,
      fromExtra: 0,
      covered: 0,
      held: 381.99,
    });
    expect(result.value).toBe(1564.02);
    expect(result.days).toBe(20);
    expect(result.perDay).toBe(78.2);
    expect(result.reserve.items.map((i) => i.name)).toEqual(["Regali di Natale", "IMU"]);
  });

  it("lets the tredicesima earned so far pay for the big expenses", () => {
    const result = computeTrueSalary({
      ...base,
      extraSalaries: { thirteenth: 1800, fourteenth: null },
    });
    expect(result.reserve).toMatchObject({ reserved: 381.99, fromExtra: 381.99, held: 0 });
    // Never more than the big expenses: the rest of the tredicesima isn't here yet.
    expect(result.value).toBe(1946.01);
  });

  it("counts what is already on the reserve account", () => {
    const result = computeTrueSalary({
      ...base,
      reserveAccount: { name: "Conto risparmio", balance: 200 },
    });
    expect(result.reserve).toMatchObject({ covered: 200, held: 181.99 });
    expect(result.value).toBe(1764.02);
  });

  it("includes the quarterly charges found among the movements", () => {
    const result = computeTrueSalary({
      ...base,
      bigExpenses: [],
      recurring: [
        {
          key: "EXPENSE|acquedotto",
          name: "Acquedotto",
          type: "EXPENSE",
          amount: 90,
          nextDate: "2026-12-20",
          frequency: "quarterly",
        },
      ],
    });
    expect(result.reserve.items).toMatchObject([{ source: "recurring", reserved: 16.81 }]);
    expect(result.fixed.items).toEqual([]);
  });

  it("can go below zero", () => {
    const result = computeTrueSalary({ ...base, everyday: [{ name: "Conto", balance: 100 }] });
    expect(result.value).toBe(-335.98);
    expect(result.perDay).toBe(-16.8);
  });
});

describe("yearAhead", () => {
  it("puts the payments of the next twelve months in their month", () => {
    const plan = yearAhead({ today: TODAY, bigExpenses: [imu, gifts], recurring: [] });
    expect(plan.months.map((m) => m.key)).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
      "2027-07",
      "2027-08",
      "2027-09",
    ]);
    expect(plan.months[2]).toMatchObject({ key: "2026-12", total: 506 });
    expect(plan.months[2].items.map((i) => i.name)).toEqual(["Regali di Natale", "IMU"]);
    expect(plan.months[8]).toMatchObject({ key: "2027-06", total: 206 });
    expect(plan.yearly).toBe(712);
    expect(plan.monthly).toBe(59.33);
  });

  it("marks what was due earlier this month as paid", () => {
    const boiler = { ...gifts, id: "caldaia", name: "Caldaia", amount: 120, months: [10] };
    const plan = yearAhead({ today: TODAY, bigExpenses: [boiler], recurring: [] });
    expect(plan.months[0].items).toEqual([
      { name: "Caldaia", date: "2026-10-01", amount: 120, source: "manual", paid: true },
    ]);
  });

  it("adds the quarterly charges four times a year", () => {
    const plan = yearAhead({
      today: TODAY,
      bigExpenses: [],
      recurring: [
        {
          key: "EXPENSE|acquedotto",
          name: "Acquedotto",
          type: "EXPENSE",
          amount: 90,
          nextDate: "2026-12-20",
          frequency: "quarterly",
        },
      ],
    });
    expect(plan.months.filter((m) => m.total > 0).map((m) => m.key)).toEqual([
      "2026-12",
      "2027-03",
      "2027-06",
      "2027-09",
    ]);
    expect(plan.yearly).toBe(360);
  });
});

describe("presets", () => {
  it("have unique keys and valid months", () => {
    const keys = BIG_EXPENSE_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of BIG_EXPENSE_PRESETS) {
      expect(p.months.length).toBeGreaterThan(0);
      expect(p.months.every((m) => m >= 1 && m <= 12)).toBe(true);
    }
    expect(presetByKey("imu")?.months).toEqual([6, 12]);
    expect(presetByKey("nope")).toBeNull();
  });

  it("find last year's payments by words and by category", () => {
    const tx = (
      date: string,
      description: string,
      amount: number,
      category: string | null = null,
    ) => ({
      date,
      description,
      amount,
      category,
      parentCategory: null,
    });
    const history = [
      tx("2026-06-16", "F24 IMU acconto", 206),
      tx("2025-12-16", "F24 IMU saldo", 200),
      tx("2025-09-01", "F24 IMU vecchio", 190),
      tx("2026-05-12", "Imposta di bollo", 34.2),
      tx("2025-12-10", "Regalo per la mamma", 60, "Regali e donazioni"),
      tx("2026-05-04", "Regalo di compleanno", 30, "Regali e donazioni"),
    ];
    expect(lastYearAmount(presetByKey("imu")!, history, TODAY)).toEqual({
      total: 406,
      count: 2,
      months: [6, 12],
    });
    expect(lastYearAmount(presetByKey("regali")!, history, TODAY)).toEqual({
      total: 60,
      count: 1,
      months: [12],
    });
    // "Imposta di bollo" is the bank's stamp duty, not the car tax.
    expect(lastYearAmount(presetByKey("bollo-auto")!, history, TODAY)).toBeNull();
    expect(lastYearAmount(presetByKey("tasse-piva")!, history, TODAY)).toBeNull();
  });
});
