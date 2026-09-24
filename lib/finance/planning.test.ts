import { describe, expect, it } from "vitest";
import { budgetUsage, dailyAllowance, suggestedMonthlyContribution } from "./planning";

describe("budgetUsage", () => {
  it("is ok below the alert threshold", () => {
    expect(budgetUsage(100, 200, 80)).toMatchObject({ ratio: 0.5, status: "ok", remaining: 100 });
  });

  it("warns from the threshold up to the limit", () => {
    expect(budgetUsage(160, 200, 80).status).toBe("warning");
    expect(budgetUsage(200, 200, 80).status).toBe("warning");
  });

  it("is over when the limit is exceeded", () => {
    expect(budgetUsage(230, 200, 80)).toMatchObject({ status: "over", remaining: -30 });
  });

  it("respects a custom threshold", () => {
    expect(budgetUsage(95, 100, 100).status).toBe("ok");
    expect(budgetUsage(50, 100, 50).status).toBe("warning");
  });
});

describe("dailyAllowance", () => {
  it("spreads the remainder over the days left, today included", () => {
    expect(dailyAllowance(70, 24, 30)).toBeCloseTo(10);
    expect(dailyAllowance(30, 30, 30)).toBe(30);
  });

  it("is zero when nothing is left", () => {
    expect(dailyAllowance(-5, 10, 30)).toBe(0);
  });
});

describe("suggestedMonthlyContribution", () => {
  const today = { year: 2026, month: 8 }; // September 2026

  it("divides the remainder over the months left, current month included", () => {
    // Sept 2026 -> Feb 2027 = 6 months
    const value = suggestedMonthlyContribution(1000, 4000, new Date("2027-02-15"), today);
    expect(value).toBeCloseTo(500);
  });

  it("asks for everything this month when the date is this month or past", () => {
    expect(suggestedMonthlyContribution(0, 300, new Date("2026-09-30"), today)).toBe(300);
    expect(suggestedMonthlyContribution(0, 300, new Date("2026-01-01"), today)).toBe(300);
  });

  it("is null without a date or when the goal is reached", () => {
    expect(suggestedMonthlyContribution(0, 300, null, today)).toBeNull();
    expect(suggestedMonthlyContribution(300, 300, new Date("2027-01-01"), today)).toBeNull();
  });
});
