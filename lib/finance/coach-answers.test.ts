import { describe, expect, it } from "vitest";
import { answerLocally } from "./coach-answers";
import { buildCoachReport, type CoachInput } from "./coach";
import { DEFAULT_COACH_PROFILE } from "./coach-profile";

const input: CoachInput = {
  profile: DEFAULT_COACH_PROFILE,
  currency: "EUR",
  months: [{ label: "settembre", income: 2000, expense: 1700 }],
  thisMonth: { name: "ottobre", income: 0, expense: 100, day: 3, daysInMonth: 31 },
  categories: [
    { id: "r", name: "Ristoranti e bar", icon: null, color: null, monthly: [240], thisMonth: 20 },
    { id: "t", name: "Tabacchi", icon: null, color: null, monthly: [120], thisMonth: 10 },
  ],
  savingsBalance: 3000,
  everydayBalance: 1200,
  investmentBalance: 0,
  subscriptions: [{ name: "Netflix", monthlyCost: 13.99 }],
  budgets: [],
  goals: [],
  debts: [],
  forecast: null,
  vices: { names: ["Tabacchi"], average: 120, categoryIds: ["t"] },
  smallExpenses: { count: 0, total: 0 },
  uncategorized: 0,
  salaryDay: 27,
  workRate: null,
};
const report = buildCoachReport(input);
const ctx = {
  input,
  report,
  money: (n: number) => `${Math.round(n)} €`,
  afford: () => null,
};

describe("answerLocally", () => {
  it("answers how much goes into a category", () => {
    expect(answerLocally("Quanto spendo in ristoranti?", ctx)).toContain("**240 € al mese**");
  });

  it("answers about smoking with the yearly cost", () => {
    expect(answerLocally("quanto mi costano le sigarette?", ctx)).toContain("1440 € all'anno");
  });

  it("lists the cuts", () => {
    expect(answerLocally("Dove posso risparmiare?", ctx)).toContain("Ristoranti e bar");
  });

  it("asks for the amount before judging a purchase", () => {
    expect(answerLocally("posso permettermi una vacanza?", ctx)).toContain("la cifra");
  });

  it("gives the score", () => {
    expect(answerLocally("Come sto andando?", ctx)).toContain(`${report.score}/100`);
  });

  it("suggests questions it can answer", () => {
    expect(answerLocally("ciao", ctx)).toContain("Come sto andando?");
  });
});
