import { describe, expect, it } from "vitest";
import { percentChange, summarizeByTopCategory, type CategoryInfo } from "./dashboard-math";

const categories: CategoryInfo[] = [
  { id: "casa", name: "Casa", color: "#6366f1", parentId: null },
  { id: "affitto", name: "Affitto", color: "#6366f1", parentId: "casa" },
  { id: "bollette", name: "Bollette", color: "#6366f1", parentId: "casa" },
  { id: "spesa", name: "Spesa", color: "#22c55e", parentId: null },
  { id: "svago", name: "Svago", color: "#ec4899", parentId: null },
];

describe("summarizeByTopCategory", () => {
  it("rolls subcategories up to their parent", () => {
    const slices = summarizeByTopCategory(
      [
        { categoryId: "affitto", amount: 750 },
        { categoryId: "bollette", amount: 100 },
        { categoryId: "casa", amount: 50 },
        { categoryId: "spesa", amount: 100 },
      ],
      categories,
    );
    expect(slices.map((s) => [s.name, s.value])).toEqual([
      ["Casa", 900],
      ["Spesa", 100],
    ]);
    expect(slices[0].share).toBeCloseTo(0.9);
  });

  it("folds uncategorized spending into Altro", () => {
    const slices = summarizeByTopCategory(
      [
        { categoryId: "spesa", amount: 80 },
        { categoryId: null, amount: 20 },
      ],
      categories,
    );
    expect(slices.at(-1)).toMatchObject({ id: null, name: "Altro", value: 20, share: 0.2 });
  });

  it("keeps at most maxSlices slices, folding the smallest into Altro", () => {
    const many: CategoryInfo[] = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      name: `Cat ${i}`,
      color: null,
      parentId: null,
    }));
    const sums = many.map((c, i) => ({ categoryId: c.id, amount: 100 - i * 10 }));
    const slices = summarizeByTopCategory(sums, many, 6);
    expect(slices).toHaveLength(6);
    expect(slices.slice(0, 5).map((s) => s.name)).toEqual([
      "Cat 0",
      "Cat 1",
      "Cat 2",
      "Cat 3",
      "Cat 4",
    ]);
    expect(slices[5]).toMatchObject({ name: "Altro", value: 50 + 40 + 30 });
    const total = slices.reduce((sum, s) => sum + s.share, 0);
    expect(total).toBeCloseTo(1);
  });

  it("does not create Altro when everything fits", () => {
    const slices = summarizeByTopCategory(
      [
        { categoryId: "casa", amount: 10 },
        { categoryId: "spesa", amount: 10 },
        { categoryId: "svago", amount: 10 },
      ],
      categories,
      3,
    );
    expect(slices.map((s) => s.name)).toEqual(["Casa", "Spesa", "Svago"]);
  });

  it("returns no slices when there is no spending", () => {
    expect(summarizeByTopCategory([], categories)).toEqual([]);
  });
});

describe("percentChange", () => {
  it("computes relative change", () => {
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(percentChange(75, 100)).toBeCloseTo(-25);
  });

  it("returns null without a baseline", () => {
    expect(percentChange(50, 0)).toBeNull();
  });
});
