import { describe, expect, it } from "vitest";
import { buildCoachReport, futureValue, isNeed, yearsToTarget, type CoachInput } from "./coach";
import { DEFAULT_COACH_PROFILE, readCoachProfile } from "./coach-profile";

const category = (id: string, name: string, monthly: number[], thisMonth = 0) => ({
  id,
  name,
  icon: null,
  color: null,
  monthly,
  thisMonth,
});

const base: CoachInput = {
  profile: DEFAULT_COACH_PROFILE,
  currency: "EUR",
  months: [
    { label: "luglio", income: 2000, expense: 1800 },
    { label: "agosto", income: 2000, expense: 1800 },
    { label: "settembre", income: 2000, expense: 1800 },
  ],
  thisMonth: { name: "ottobre", income: 0, expense: 300, day: 5, daysInMonth: 31 },
  categories: [
    category("casa", "Casa", [800, 800, 800]),
    category("spesa", "Spesa", [300, 300, 300]),
    category("rist", "Ristoranti e bar", [300, 300, 300]),
    category("tab", "Tabacchi", [150, 150, 150]),
    category("shop", "Shopping", [50, 50, 250]),
  ],
  savingsBalance: 1000,
  everydayBalance: 1500,
  investmentBalance: 0,
  subscriptions: [{ name: "Netflix", monthlyCost: 13 }],
  budgets: [],
  goals: [],
  debts: [],
  forecast: { lowDate: "2026-10-20", lowBalance: 400, dailySpend: 30 },
  vices: { names: ["Tabacchi"], average: 150, categoryIds: ["tab"] },
  smallExpenses: { count: 4, total: 20 },
  uncategorized: 0,
  salaryDay: 27,
  workRate: null,
};

describe("buildCoachReport", () => {
  it("measures savings against the user's own target", () => {
    const report = buildCoachReport(base);
    expect(report.averages.savingsRate).toBeCloseTo(10);
    expect(report.pillars.find((p) => p.id === "savings")!.score).toBe(50);
    expect(report.tips.some((t) => t.id === "savings-gap")).toBe(true);
  });

  it("praises a target that is met", () => {
    const report = buildCoachReport({
      ...base,
      profile: { ...DEFAULT_COACH_PROFILE, savingsTarget: 10 },
    });
    expect(report.tips.some((t) => t.id === "savings-ok")).toBe(true);
  });

  it("warns first about an overdraft ahead", () => {
    const report = buildCoachReport({
      ...base,
      forecast: { lowDate: "2026-10-20", lowBalance: -120, dailySpend: 30 },
    });
    expect(report.tips[0].id).toBe("forecast");
    expect(report.tips[0].kind).toBe("alert");
  });

  it("never suggests cutting a protected category", () => {
    const report = buildCoachReport({
      ...base,
      profile: { ...DEFAULT_COACH_PROFILE, protectedCategoryIds: ["rist", "tab"] },
    });
    expect(report.cuts.map((c) => c.id)).not.toContain("rist");
    expect(report.tips.some((t) => t.id === "vices")).toBe(false);
    expect(report.plan.note).toContain("Ristoranti e bar");
  });

  it("proposes halving vices and a fifth of the other wants", () => {
    const report = buildCoachReport(base);
    expect(report.cuts.find((c) => c.id === "tab")!.cut).toBe(75);
    expect(report.cuts.find((c) => c.id === "rist")!.cut).toBe(60);
  });

  it("makes vices a priority when the user asks for it", () => {
    const report = buildCoachReport({
      ...base,
      profile: { ...DEFAULT_COACH_PROFILE, priorities: ["vizi"] },
    });
    const vices = report.tips.find((t) => t.id === "vices")!;
    expect(vices.kind).toBe("warn");
    expect(vices.title).toContain("1.800");
  });

  it("spots a category growing fast", () => {
    const report = buildCoachReport(base);
    const drift = report.tips.find((t) => t.id === "drift-shop");
    expect(drift?.body).toMatch(/^A settembre/);
  });

  it("builds the 50/30/20 plan from needs and wants", () => {
    const report = buildCoachReport(base);
    const [needs, wants] = report.plan.rows;
    expect(needs.actual).toBeCloseTo(55);
    expect(wants.actual).toBeCloseTo(28.33, 1);
  });

  it("suggests an automatic transfer on salary day to pay yourself first", () => {
    const report = buildCoachReport({
      ...base,
      profile: { ...DEFAULT_COACH_PROFILE, method: "paga-te-stesso", savingsTarget: 15 },
    });
    const tip = report.tips.find((t) => t.id === "pay-yourself")!;
    expect(tip.body).toContain("Il giorno 27");
    expect(tip.title).toContain("300");
  });

  it("points at the most expensive debt", () => {
    const report = buildCoachReport({
      ...base,
      debts: [
        { name: "Auto", balance: 5000, apr: 6.9, minPayment: 190 },
        { name: "Revolving", balance: 1400, apr: 17.9, minPayment: 55 },
      ],
    });
    expect(report.tips.find((t) => t.id === "debt")!.title).toContain("Revolving");
  });

  it("works for a brand-new user with only this month", () => {
    const report = buildCoachReport({ ...base, months: [], categories: [] });
    expect(report.hasData).toBe(true);
    expect(report.averages.expense).toBeCloseTo(300 * (31 / 5));
  });

  it("adapts the headline to the tone", () => {
    const gentle = buildCoachReport(base).headline;
    const direct = buildCoachReport({
      ...base,
      profile: { ...DEFAULT_COACH_PROFILE, tone: "diretto" },
    }).headline;
    expect(gentle).not.toBe(direct);
  });
});

describe("helpers", () => {
  it("classifies needs", () => {
    expect(isNeed("Casa")).toBe(true);
    expect(isNeed("Tabacchi")).toBe(false);
  });

  it("compounds monthly savings", () => {
    expect(futureValue(100, 1, 0)).toBe(1200);
    expect(futureValue(100, 10, 0.03)).toBeGreaterThan(13_900);
  });

  it("counts the years to a target", () => {
    expect(yearsToTarget(0, 1000, 3000, 0)).toBe(3);
    expect(yearsToTarget(100, 0, 3000)).toBeNull();
  });

  it("reads a stored profile, falling back to defaults", () => {
    expect(readCoachProfile(null).configured).toBe(false);
    expect(readCoachProfile({ method: "fire", savingsTarget: 45 }).profile.method).toBe("fire");
    expect(readCoachProfile({ method: "boh" }).profile).toEqual(DEFAULT_COACH_PROFILE);
  });
});
