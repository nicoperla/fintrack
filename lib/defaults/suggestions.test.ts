import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "./categories";
import { suggestMissingCategories, type ExistingCategory } from "./suggestions";

const everything: ExistingCategory[] = DEFAULT_CATEGORIES.flatMap((c) => [
  { name: c.name, type: c.type, parentName: null },
  ...(c.children ?? []).map((ch) => ({ name: ch.name, type: c.type, parentName: c.name })),
]);

describe("suggestMissingCategories", () => {
  it("suggests nothing when every starter category exists", () => {
    expect(suggestMissingCategories(everything)).toEqual([]);
  });

  it("suggests a whole missing category with its subcategories", () => {
    const without = everything.filter((c) => c.name !== "Tabacchi" && c.parentName !== "Tabacchi");
    const [tobacco] = suggestMissingCategories(without);
    expect(tobacco.category.name).toBe("Tabacchi");
    expect(tobacco.missingParent).toBe(true);
    expect(tobacco.missingChildren.map((c) => c.name)).toEqual([
      "Sigarette",
      "Svapo e IQOS",
      "Lotto e gratta e vinci",
    ]);
  });

  it("suggests only the new subcategories of an existing category", () => {
    const without = everything.filter((c) => c.name !== "Farmacia");
    const [health] = suggestMissingCategories(without);
    expect(health).toMatchObject({ missingParent: false });
    expect(health.category.name).toBe("Salute");
    expect(health.missingChildren.map((c) => c.name)).toEqual(["Farmacia"]);
  });

  it("matches names without case and ignores same names of the other type", () => {
    const existing: ExistingCategory[] = [
      ...everything.filter((c) => c.name !== "Tabacchi" && c.parentName !== "Tabacchi"),
      { name: "TABACCHI", type: "EXPENSE", parentName: null },
      { name: "sigarette", type: "EXPENSE", parentName: "tabacchi" },
    ];
    const [tobacco] = suggestMissingCategories(existing);
    expect(tobacco.missingParent).toBe(false);
    expect(tobacco.missingChildren.map((c) => c.name)).toEqual([
      "Svapo e IQOS",
      "Lotto e gratta e vinci",
    ]);
  });
});
