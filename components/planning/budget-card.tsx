"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Meter } from "@/components/planning/meter";
import { BudgetStatusBadge } from "@/components/planning/budget-status";
import { BudgetFormDialog } from "@/components/planning/budget-form-dialog";
import { deleteBudget } from "@/app/(dashboard)/budgets/actions";
import { CategoryIcon } from "@/lib/category-style";
import { formatCurrency } from "@/lib/format";
import type { BudgetStatus } from "@/lib/finance/planning";
import type { CategoryOption } from "@/lib/dto";

export type BudgetDTO = {
  id: string;
  categoryId: string;
  categoryName: string;
  parentName: string | null;
  icon: string | null;
  color: string | null;
  amount: number;
  alertThreshold: number;
  spent: number;
  ratio: number;
  remaining: number;
  status: BudgetStatus;
  dailyAllowance: number;
};

export function BudgetCard({
  budget,
  categories,
  usedCategoryIds,
  monthRange,
}: {
  budget: BudgetDTO;
  categories: CategoryOption[];
  usedCategoryIds: string[];
  monthRange: { from: string; to: string };
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const title = budget.parentName
    ? `${budget.parentName} › ${budget.categoryName}`
    : budget.categoryName;
  const href = `/transactions?${new URLSearchParams({ categoryId: budget.categoryId, ...monthRange })}`;

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <CategoryIcon name={budget.icon} color={budget.color} />
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate font-medium hover:underline">
            {title}
          </Link>
          <BudgetStatusBadge status={budget.status} />
        </div>
        <div className="-mt-1 -mr-1 flex">
          <BudgetFormDialog
            budget={budget}
            categories={categories}
            usedCategoryIds={usedCategoryIds}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Modifica budget ${title}`}>
                <Pencil />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Elimina budget ${title}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-lg font-semibold tracking-tight">{formatCurrency(budget.spent)}</p>
        <p className="text-muted-foreground text-sm">di {formatCurrency(budget.amount)}</p>
      </div>
      <Meter
        value={budget.ratio}
        tone={budget.status}
        label={`${title}: speso il ${Math.round(budget.ratio * 100)}% del budget`}
      />
      <p className="text-muted-foreground text-xs">
        {budget.status === "over"
          ? `Superato di ${formatCurrency(-budget.remaining)}`
          : `Restano ${formatCurrency(budget.remaining)} · circa ${formatCurrency(budget.dailyAllowance)} al giorno`}
      </p>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Eliminare il budget "${title}"?`}
        description="I movimenti non vengono toccati: smetti solo di monitorare il limite mensile."
        successMessage="Budget eliminato"
        onConfirm={() => deleteBudget(budget.id)}
      />
    </div>
  );
}
