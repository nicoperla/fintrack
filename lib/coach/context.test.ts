import { describe, expect, it } from "vitest";
import { buildCoachContext } from "./context";
import { buildCoachReport, type CoachInput } from "@/lib/finance/coach";
import { DEFAULT_COACH_PROFILE } from "@/lib/finance/coach-profile";
import type { CoachData } from "@/lib/data/coach";

const input: CoachInput = {
  profile: { ...DEFAULT_COACH_PROFILE, protectedCategoryIds: ["v"], note: "Voglio viaggiare" },
  currency: "EUR",
  months: [{ label: "settembre", income: 2000, expense: 1700 }],
  thisMonth: { name: "ottobre", income: 0, expense: 100, day: 3, daysInMonth: 31 },
  categories: [{ id: "v", name: "Viaggi", icon: null, color: null, monthly: [300], thisMonth: 0 }],
  savingsBalance: 3000,
  everydayBalance: 1200,
  investmentBalance: 0,
  subscriptions: [],
  budgets: [],
  goals: [],
  debts: [],
  forecast: null,
  vices: { names: [], average: 0, categoryIds: [] },
  smallExpenses: { count: 0, total: 0 },
  uncategorized: 0,
  salaryDay: null,
  workRate: null,
};

const data = {
  input,
  report: buildCoachReport(input),
  profile: input.profile,
  expenseCategories: [{ id: "v", name: "Viaggi", icon: null, color: null }],
  forecast: null,
} as unknown as CoachData;

describe("buildCoachContext", () => {
  const text = buildCoachContext(
    data,
    [
      {
        date: "2026-10-02",
        type: "EXPENSE",
        amount: 6.2,
        description: "Tabaccheria",
        category: "Tabacchi › Sigarette",
        account: "Contanti",
        tags: [],
      },
    ],
    { name: "Demo", spaceName: "Casa Demo", today: "2026-10-03" },
  );

  it("tells the model how the user wants to manage money", () => {
    expect(text).toContain("Categorie da non toccare: Viaggi.");
    expect(text).toContain('Nelle sue parole: "Voglio viaggiare"');
  });

  it("includes the movements", () => {
    // Intl puts a no-break space before the currency.
    expect(text).toMatch(
      /2026-10-02 | uscita | 6,20s€ | Tabaccheria | Tabacchi › Sigarette | Contanti/,
    );
  });
});
