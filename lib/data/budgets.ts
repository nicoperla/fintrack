import { prisma } from "@/lib/db/prisma";
import { budgetUsage } from "@/lib/finance/planning";
import { currentMonth } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";

export async function getBudgetsWithSpending(userId: string) {
  const { start, end } = currentMonth();
  const [budgets, sums] = await Promise.all([
    prisma.budget.findMany({
      where: { userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
            parent: { select: { name: true } },
            children: { select: { id: true } },
          },
        },
      },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", date: { gte: start, lt: end }, categoryId: { not: null } },
      _sum: { amount: true },
    }),
  ]);

  const spentByCategory = new Map(sums.map((s) => [s.categoryId, Number(s._sum.amount ?? 0)]));

  return budgets
    .map((b) => {
      // A budget on a parent category covers its subcategories too.
      const categoryIds = [b.categoryId, ...b.category.children.map((c) => c.id)];
      const spent = categoryIds.reduce((sum, id) => sum + (spentByCategory.get(id) ?? 0), 0);
      const amount = Number(b.amount);
      return {
        id: b.id,
        categoryId: b.categoryId,
        categoryName: b.category.name,
        parentName: b.category.parent?.name ?? null,
        icon: b.category.icon,
        color: b.category.color,
        amount,
        alertThreshold: b.alertThreshold,
        spent,
        ...budgetUsage(spent, amount, b.alertThreshold),
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

export type BudgetWithSpending = Awaited<ReturnType<typeof getBudgetsWithSpending>>[number];

/** Messages for budgets touched by an expense in `categoryId` that are now at or over their threshold. */
export async function getBudgetWarnings(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { parentId: true },
  });
  if (!category) return [];
  const relevantIds = new Set([categoryId, category.parentId].filter((v): v is string => !!v));

  const budgets = await getBudgetsWithSpending(userId);
  return budgets
    .filter((b) => relevantIds.has(b.categoryId) && b.status !== "ok")
    .map((b) =>
      b.status === "over"
        ? `Budget "${b.categoryName}" superato: ${formatCurrency(b.spent)} su ${formatCurrency(b.amount)}`
        : `Budget "${b.categoryName}" al ${Math.round(b.ratio * 100)}%: restano ${formatCurrency(b.remaining)}`,
    );
}
