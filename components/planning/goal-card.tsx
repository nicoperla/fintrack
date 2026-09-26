"use client";

import { useState } from "react";
import { CalendarClock, PartyPopper, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Meter } from "@/components/planning/meter";
import { ContributionDialog, GoalFormDialog } from "@/components/planning/goal-dialogs";
import { deleteGoal } from "@/app/(dashboard)/goals/actions";
import { CategoryIcon, DEFAULT_CATEGORY_COLOR } from "@/lib/category-style";
import { useMoney } from "@/components/currency-provider";
import { cn } from "@/lib/utils";

export type GoalDTO = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  progress: number;
  completed: boolean;
  overdue: boolean;
  suggestedMonthly: number | null;
};

const monthYear = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const percent = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0 });

export function GoalCard({ goal }: { goal: GoalDTO }) {
  const money = useMoney();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const color = goal.color ?? DEFAULT_CATEGORY_COLOR;
  const remaining = goal.targetAmount - goal.currentAmount;

  return (
    <div
      className={cn(
        "bg-card relative flex flex-col gap-4 overflow-hidden rounded-xl border p-4",
        goal.completed && "border-transparent",
      )}
      style={goal.completed ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
    >
      {goal.completed && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ background: `radial-gradient(circle at 85% 0%, ${color}, transparent 60%)` }}
        />
      )}
      <div className="flex items-start gap-3">
        <CategoryIcon name={goal.icon} color={goal.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{goal.name}</p>
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            {goal.completed ? (
              <>
                <PartyPopper className="size-3.5" aria-hidden />
                Obiettivo raggiunto
              </>
            ) : goal.targetDate ? (
              <>
                <CalendarClock className="size-3.5" aria-hidden />
                {goal.overdue ? "Scaduto a " : "Entro "}
                {monthYear.format(new Date(`${goal.targetDate}T00:00:00Z`))}
              </>
            ) : (
              "Senza scadenza"
            )}
          </p>
        </div>
        <div className="-mt-1 -mr-1 flex">
          <GoalFormDialog
            goal={goal}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Modifica ${goal.name}`}>
                <Pencil />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Elimina ${goal.name}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-xl font-semibold tracking-tight">{money(goal.currentAmount)}</p>
          <p className="text-muted-foreground text-sm">
            {percent.format(goal.progress)} di {money(goal.targetAmount)}
          </p>
        </div>
        <Meter
          value={goal.progress}
          color={color}
          label={`${goal.name}: ${percent.format(goal.progress)} dell'obiettivo`}
          className="h-2.5"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {goal.completed
            ? "Complimenti, ce l'hai fatta!"
            : goal.suggestedMonthly !== null
              ? goal.overdue
                ? `Mancano ${money(remaining)}`
                : `Metti da parte ${money(goal.suggestedMonthly)} al mese`
              : `Mancano ${money(remaining)}`}
        </p>
        <ContributionDialog
          goal={goal}
          trigger={
            <Button variant="outline" size="sm">
              <Plus data-icon="inline-start" />
              Versa
            </Button>
          }
        />
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Eliminare "${goal.name}"?`}
        description="L'obiettivo e il suo progresso verranno eliminati. I tuoi conti non vengono toccati."
        successMessage="Obiettivo eliminato"
        onConfirm={() => deleteGoal(goal.id)}
      />
    </div>
  );
}
