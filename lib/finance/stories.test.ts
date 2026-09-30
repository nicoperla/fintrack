import { describe, expect, it } from "vitest";
import { buildStory, pickArchetype, type StoryTx } from "./stories";

const food = { id: "food", name: "Ristoranti e bar", icon: null, color: null };
const home = { id: "home", name: "Casa", icon: null, color: null };

const tx = (day: number, amount: number, description: string, category = food): StoryTx => ({
  date: `2026-09-${String(day).padStart(2, "0")}`,
  type: "EXPENSE",
  amount,
  description,
  category,
});

const transactions: StoryTx[] = [
  { date: "2026-09-27", type: "INCOME", amount: 2000, description: "Stipendio", category: null },
  tx(1, 700, "Affitto", home),
  tx(3, 12, "Bar Centrale"),
  tx(4, 9, "BAR CENTRALE"),
  tx(5, 11, "Bar Centrale"),
  tx(5, 40, "Pizzeria"),
  tx(12, 80, "Sushi"),
];

describe("buildStory", () => {
  const story = buildStory({
    month: "2026-09",
    daysInMonth: 30,
    lastDay: 30,
    transactions,
    previous: { income: 2000, expense: 900, categories: [{ id: "food", amount: 60 }] },
  });

  it("sums the month", () => {
    expect(story.expense).toBe(852);
    expect(story.saved).toBe(1148);
    expect(story.count).toBe(7);
  });

  it("finds the biggest expense and the most visited place", () => {
    expect(story.biggest?.description).toBe("Affitto");
    expect(story.place).toEqual({ name: "Bar Centrale", count: 3, amount: 32 });
  });

  it("finds the priciest day and the no-spend streak", () => {
    expect(story.priciestDay?.date).toBe("2026-09-01");
    expect(story.noSpendDays).toBe(25);
    expect(story.longestStreak).toBe(18);
  });

  it("compares with the previous month", () => {
    expect(story.previous?.change).toBeCloseTo(-5.33, 1);
    expect(story.mover?.name).toBe("Ristoranti e bar");
    expect(story.mover?.delta).toBe(92);
  });

  it("saving over a third makes you zen", () => {
    expect(story.archetype.id).toBe("zen");
  });
});

describe("pickArchetype", () => {
  const base = { saved: 100, savingsRate: 10, noSpendDays: 2 };
  it("spending more than you earn comes first", () => {
    expect(pickArchetype({ ...base, saved: -5, categories: [] }).id).toBe("generoso");
  });
  it("uses a category that stands out", () => {
    expect(
      pickArchetype({
        ...base,
        categories: [
          { name: "Casa", share: 0.3 },
          { name: "Viaggi", share: 0.2 },
        ],
      }).id,
    ).toBe("esploratore");
  });
  it("falls back to the balanced profile", () => {
    expect(pickArchetype({ ...base, categories: [{ name: "Salute", share: 0.5 }] }).id).toBe(
      "equilibrista",
    );
  });
});
