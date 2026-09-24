export type CategorySum = { categoryId: string | null; amount: number };
export type CategoryInfo = {
  id: string;
  name: string;
  color: string | null;
  parentId: string | null;
};
export type Slice = {
  id: string | null;
  name: string;
  color: string | null;
  value: number;
  share: number;
};

export const OTHER_SLICE_NAME = "Altro";

/**
 * Rolls expenses up to their top-level category and keeps at most `maxSlices` slices:
 * the largest ones, with the tail (and uncategorized spending) folded into "Altro".
 */
export function summarizeByTopCategory(
  sums: CategorySum[],
  categories: CategoryInfo[],
  maxSlices = 6,
): Slice[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();
  let other = 0;

  for (const { categoryId, amount } of sums) {
    const category = categoryId ? byId.get(categoryId) : undefined;
    if (!category) {
      other += amount;
      continue;
    }
    const rootId =
      category.parentId && byId.has(category.parentId) ? category.parentId : category.id;
    totals.set(rootId, (totals.get(rootId) ?? 0) + amount);
  }

  const ranked = Array.from(totals, ([id, value]) => ({ id, value })).sort(
    (a, b) => b.value - a.value,
  );
  const room = other > 0 ? maxSlices - 1 : maxSlices;
  const kept = ranked.length > room ? ranked.slice(0, maxSlices - 1) : ranked;
  other += ranked.slice(kept.length).reduce((sum, r) => sum + r.value, 0);

  const grandTotal = kept.reduce((sum, r) => sum + r.value, 0) + other;
  if (grandTotal <= 0) return [];

  const slices: Slice[] = kept.map(({ id, value }) => {
    const category = byId.get(id)!;
    return { id, name: category.name, color: category.color, value, share: value / grandTotal };
  });
  if (other > 0) {
    slices.push({
      id: null,
      name: OTHER_SLICE_NAME,
      color: null,
      value: other,
      share: other / grandTotal,
    });
  }
  return slices;
}

/** Relative change in percent, or null when there is no meaningful baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
