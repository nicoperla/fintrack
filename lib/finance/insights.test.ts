import { describe, expect, it } from "vitest";
import { generateInsights, inMonth, type InsightInput } from "./insights";

// Intl puts a non-breaking space before "€"; compare with plain spaces.
const plain = (s: string | undefined) => s?.replace(/ /g, " ");

const cat = (id: string, amount: number) => ({ id, name: id, icon: null, color: null, amount });

const base: InsightInput = {
  monthName: "settembre",
  previousMonthName: "agosto",
  categoriesNow: [],
  categoriesPrevious: [],
  spentNow: 0,
  spentPrevious: 0,
  lastMonth: { name: "agosto", income: 0, expense: 0 },
  topMerchant: null,
  weekdayAverage: 0,
  weekendAverage: 0,
  noSpendDays: 0,
};

describe("inMonth", () => {
  it("uses 'ad' before a vowel a", () => {
    expect(inMonth("agosto")).toBe("ad agosto");
    expect(inMonth("aprile")).toBe("ad aprile");
    expect(inMonth("settembre")).toBe("a settembre");
  });
});

describe("generateInsights", () => {
  it("reports category increases above both thresholds", () => {
    const insights = generateInsights({
      ...base,
      categoriesNow: [cat("Ristoranti", 160), cat("Spesa", 105)],
      categoriesPrevious: [cat("Ristoranti", 130), cat("Spesa", 100)],
    });
    expect(insights.map((i) => i.id)).toEqual(["up-Ristoranti"]);
    expect(plain(insights[0].text)).toBe(
      "In Ristoranti hai speso il 23% in più rispetto allo stesso periodo di agosto (+30,00 €).",
    );
    expect(insights[0].tone).toBe("negative");
  });

  it("ignores small absolute changes even when the percentage is large", () => {
    const insights = generateInsights({
      ...base,
      categoriesNow: [cat("Bar", 12)],
      categoriesPrevious: [cat("Bar", 5)],
    });
    expect(insights).toEqual([]);
  });

  it("reports the biggest decrease as good news, including categories that dropped to zero", () => {
    const insights = generateInsights({
      ...base,
      categoriesNow: [cat("Shopping", 40)],
      categoriesPrevious: [cat("Shopping", 100), cat("Viaggi", 300)],
    });
    const down = insights.find((i) => i.kind === "category-down");
    expect(down?.id).toBe("down-Viaggi");
    expect(down?.tone).toBe("positive");
  });

  it("describes spending pace and last month's savings rate", () => {
    const insights = generateInsights({
      ...base,
      spentNow: 900,
      spentPrevious: 1000,
      lastMonth: { name: "agosto", income: 2400, expense: 1800 },
    });
    expect(insights.map((i) => plain(i.text))).toEqual([
      "Finora a settembre hai speso 900,00 €, il 10% in meno rispetto allo stesso periodo di agosto.",
      "Ad agosto hai messo da parte il 25% delle entrate (600,00 €): ottimo lavoro.",
    ]);
  });

  it("flags a month where spending exceeded income", () => {
    const [insight] = generateInsights({
      ...base,
      lastMonth: { name: "luglio", income: 1000, expense: 1200 },
    });
    expect(insight.tone).toBe("negative");
    expect(plain(insight.text)).toBe("A luglio hai speso 200,00 € più di quanto è entrato.");
  });

  it("orders category insights before lifestyle ones", () => {
    const insights = generateInsights({
      ...base,
      categoriesNow: [cat("Ristoranti", 200)],
      categoriesPrevious: [cat("Ristoranti", 100)],
      topMerchant: { name: "Esselunga", count: 6, amount: 254 },
      weekdayAverage: 20,
      weekendAverage: 40,
      noSpendDays: 4,
    });
    expect(insights.map((i) => i.kind)).toEqual(["category-up", "merchant", "weekend", "no-spend"]);
  });
});
