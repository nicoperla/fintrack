import { CategoryList } from "@/components/categories/category-list";
import { requireSpace } from "@/lib/auth/session";
import { getCategoryTree } from "@/lib/data/categories";
import { SuggestedCategories } from "@/components/categories/suggested-categories";
import { suggestMissingCategories } from "@/lib/defaults/suggestions";

export const metadata = { title: "Categorie · FinTrack" };

export default async function CategoriesPage() {
  const space = await requireSpace();
  const tree = await getCategoryTree(space.id);

  const parents = [...tree.expense, ...tree.income].map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type === "INCOME" ? ("INCOME" as const) : ("EXPENSE" as const),
  }));

  const suggestions = suggestMissingCategories(
    [...tree.expense, ...tree.income].flatMap((c) => [
      { name: c.name, type: c.type, parentName: null },
      ...c.children.map((ch) => ({ name: ch.name, type: ch.type, parentName: c.name })),
    ]),
  ).map((s) => ({
    name: s.category.name,
    icon: s.category.icon,
    color: s.category.color,
    missingParent: s.missingParent,
    children: s.missingChildren.map((c) => c.name),
  }));

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorie</h1>
        <p className="text-muted-foreground text-sm">
          Organizza entrate e uscite con categorie e sottocategorie.
        </p>
      </div>
      {/* Remounted when the list changes, so the selection resets after adding. */}
      <SuggestedCategories
        key={suggestions.map((s) => s.name).join("|")}
        suggestions={suggestions}
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <CategoryList title="Uscite" type="EXPENSE" roots={tree.expense} parents={parents} />
        <CategoryList title="Entrate" type="INCOME" roots={tree.income} parents={parents} />
      </div>
    </div>
  );
}
