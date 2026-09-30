import { DEFAULT_CATEGORIES, type DefaultCategory } from "@/lib/defaults/categories";

export type ExistingCategory = {
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  parentName: string | null;
};

export type Suggestion = {
  /** The default top-level category this suggestion is about. */
  category: DefaultCategory;
  /** False when the space already has a top-level category with this name. */
  missingParent: boolean;
  /** Subcategories to add (all of them when the parent is missing). */
  missingChildren: { name: string; icon: string }[];
};

const key = (name: string) => name.trim().toLocaleLowerCase("it");

/**
 * Starter categories (and subcategories) a space doesn't have yet. Names are compared without
 * case, so a category the user created or renamed the same way is never duplicated.
 */
export function suggestMissingCategories(existing: ExistingCategory[]): Suggestion[] {
  const roots = new Set(
    existing.filter((c) => c.parentName === null).map((c) => `${c.type}|${key(c.name)}`),
  );
  const children = new Set(
    existing
      .filter((c) => c.parentName !== null)
      .map((c) => `${c.type}|${key(c.parentName!)}|${key(c.name)}`),
  );

  return DEFAULT_CATEGORIES.flatMap((category) => {
    const missingParent = !roots.has(`${category.type}|${key(category.name)}`);
    const missingChildren = (category.children ?? []).filter(
      (child) =>
        missingParent || !children.has(`${category.type}|${key(category.name)}|${key(child.name)}`),
    );
    return missingParent || missingChildren.length
      ? [{ category, missingParent, missingChildren }]
      : [];
  });
}
