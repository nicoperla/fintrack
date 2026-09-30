import { describe, expect, it } from "vitest";
import { forecastBalance, type ForecastRecurring } from "./forecast";

const salary: ForecastRecurring = {
  name: "Stipendio",
  type: "INCOME",
  amount: 2000,
  nextDate: "2026-10-27",
  frequency: "monthly",
};
const rent: ForecastRecurring = {
  name: "Affitto",
  type: "EXPENSE",
  amount: 750,
  nextDate: "2026-10-01",
  frequency: "monthly",
};

describe("forecastBalance", () => {
  it("applies recurring movements on their days and daily spending in between", () => {
    const f = forecastBalance({
      today: "2026-09-30",
      start: 1000,
      days: 45,
      dailySpend: 20,
      recurring: [salary, rent],
    });
    expect(f.points).toHaveLength(46);
    expect(f.points[0]).toEqual({ date: "2026-09-30", balance: 1000 });
    // 1 Oct: rent and one day of spending.
    expect(f.points[1]).toEqual({ date: "2026-10-01", balance: 230 });
    // Lowest the day before payday: 230 − 25 more days of spending.
    expect(f.low).toEqual({ date: "2026-10-26", balance: -270 });
    expect(f.events.map((e) => `${e.date} ${e.name}`)).toEqual([
      "2026-10-01 Affitto",
      "2026-10-27 Stipendio",
      "2026-11-01 Affitto",
    ]);
    expect(f.end).toBe(1000 - 750 + 2000 - 750 - 45 * 20);
  });

  it("repeats weekly movements within the period", () => {
    const f = forecastBalance({
      today: "2026-09-30",
      start: 0,
      days: 21,
      dailySpend: 0,
      recurring: [
        {
          name: "Pulizie",
          type: "EXPENSE",
          amount: 30,
          nextDate: "2026-10-02",
          frequency: "weekly",
        },
      ],
    });
    expect(f.events.map((e) => e.date)).toEqual(["2026-10-02", "2026-10-09", "2026-10-16"]);
    expect(f.end).toBe(-90);
  });

  it("still counts a salary a few days late, today", () => {
    const f = forecastBalance({
      today: "2026-09-30",
      start: 100,
      days: 10,
      dailySpend: 0,
      recurring: [{ ...salary, nextDate: "2026-09-27" }],
    });
    expect(f.events[0]).toEqual({ date: "2026-09-30", name: "Stipendio", amount: 2000 });
    expect(f.points[0].balance).toBe(2100);
  });

  it("skips occurrences long overdue and moves to the next one", () => {
    const f = forecastBalance({
      today: "2026-09-30",
      start: 0,
      days: 45,
      dailySpend: 0,
      recurring: [{ ...rent, nextDate: "2026-09-01" }],
    });
    expect(f.events.map((e) => e.date)).toEqual(["2026-10-01", "2026-11-01"]);
  });
});
