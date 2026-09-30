import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { BudgetCard } from "@/components/planning/budget-card";
import { BudgetFormDialog } from "@/components/planning/budget-form-dialog";
import { Meter } from "@/components/planning/meter";
import { requireSpace } from "@/lib/auth/session";
import { getBudgetsWithSpending } from "@/lib/data/budgets";
import { getCategoryTree } from "@/lib/data/categories";
import { currentMonth, formatMonthYear } from "@/lib/dates";
import { toCategoryOptions } from "@/lib/dto";
import { dailyAllowance } from "@/lib/finance/planning";
import { toDateInputValue } from "@/lib/format";
import { Amount } from "@/components/amount";

export const metadata = { title: "Budget · FinTrack" };

export default async function BudgetsPage() {
  const space = await requireSpace();
  const month = currentMonth();
  const [budgets, tree] = await Promise.all([
    getBudgetsWithSpending(space.id),
    getCategoryTree(space.id),
  ]);
  const categories = toCategoryOptions(tree.expense);
  const usedCategoryIds = budgets.map((b) => b.categoryId);
  const monthRange = {
    from: toDateInputValue(month.start),
    to: toDateInputValue(new Date(month.end.getTime() - 86_400_000)),
  };

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const overCount = budgets.filter((b) => b.status === "over").length;
  const warnCount = budgets.filter((b) => b.status === "warning").length;

  const newButton = (
    <Button>
      <Plus data-icon="inline-start" />
      Nuovo budget
    </Button>
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
          <p className="text-muted-foreground text-sm">{formatMonthYear(month.start)}</p>
        </div>
        {budgets.length > 0 && (
          <BudgetFormDialog
            categories={categories}
            usedCategoryIds={usedCategoryIds}
            trigger={newButton}
          />
        )}
      </div>

      {budgets.length === 0 ? (
        <EmptyState
          illustration="target"
          title="Dai un limite alle tue spese"
          description="Imposta un budget mensile per le categorie che vuoi tenere d'occhio: ti avvisiamo quando ti avvicini al limite."
          action={
            categories.length > 0 ? (
              <BudgetFormDialog categories={categories} usedCategoryIds={[]} trigger={newButton} />
            ) : undefined
          }
        />
      ) : (
        <>
          <section
            className="bg-card grid gap-3 rounded-xl border p-4"
            aria-label="Riepilogo budget"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm">
                Speso{" "}
                <span className="font-semibold">
                  <Amount value={totalSpent} />
                </span>{" "}
                <span className="text-muted-foreground">
                  su <Amount value={totalBudget} /> di budget
                </span>
              </p>
              <p className="text-muted-foreground text-xs">
                {overCount + warnCount === 0
                  ? "Tutti i budget sono in linea"
                  : [
                      overCount > 0 && `${overCount} superat${overCount === 1 ? "o" : "i"}`,
                      warnCount > 0 && `${warnCount} vicin${warnCount === 1 ? "o" : "i"} al limite`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </p>
            </div>
            <Meter
              value={totalBudget > 0 ? totalSpent / totalBudget : 0}
              tone={totalSpent > totalBudget ? "over" : "ok"}
              label={`Speso il ${Math.round((totalSpent / totalBudget) * 100)}% del budget complessivo`}
            />
          </section>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {budgets.map((b) => (
              <BudgetCard
                key={b.id}
                budget={{
                  ...b,
                  dailyAllowance: dailyAllowance(b.remaining, month.day, month.daysInMonth),
                }}
                categories={categories}
                usedCategoryIds={usedCategoryIds}
                monthRange={monthRange}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
