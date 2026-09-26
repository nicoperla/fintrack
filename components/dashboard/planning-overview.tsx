"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Meter } from "@/components/planning/meter";
import { BudgetStatusBadge } from "@/components/planning/budget-status";
import { CategoryIcon } from "@/lib/category-style";
import { useMoney } from "@/components/currency-provider";
import type { BudgetWithSpending } from "@/lib/data/budgets";
import type { GoalWithProgress } from "@/lib/data/goals";

function CardHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-medium">{title}</h2>
      <Link
        href={href}
        className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-sm"
      >
        {linkLabel}
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

export function BudgetsOverview({ budgets }: { budgets: BudgetWithSpending[] }) {
  const money = useMoney();
  return (
    <section className="bg-card flex h-full flex-col gap-4 rounded-xl border p-4">
      <CardHeader
        title="Budget del mese"
        href="/budgets"
        linkLabel={budgets.length ? "Tutti" : "Imposta"}
      />
      {budgets.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Nessun budget impostato. Dai un limite alle categorie che vuoi tenere d&apos;occhio.
        </p>
      ) : (
        <ul className="grid gap-4">
          {budgets.slice(0, 4).map((b) => (
            <li key={b.id} className="grid gap-2">
              <div className="flex items-center gap-2">
                <CategoryIcon name={b.icon} color={b.color} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {b.categoryName}
                </span>
                <BudgetStatusBadge status={b.status} />
              </div>
              <Meter
                value={b.ratio}
                tone={b.status}
                label={`${b.categoryName}: ${Math.round(b.ratio * 100)}%`}
              />
              <p className="text-muted-foreground text-xs">
                {money(b.spent)} di {money(b.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function GoalsOverview({ goals }: { goals: GoalWithProgress[] }) {
  const money = useMoney();
  const active = goals.filter((g) => !g.completed);
  return (
    <section className="bg-card flex h-full flex-col gap-4 rounded-xl border p-4">
      <CardHeader title="Obiettivi" href="/goals" linkLabel={goals.length ? "Tutti" : "Crea"} />
      {active.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {goals.length > 0
            ? "Hai raggiunto tutti i tuoi obiettivi. Pronto per il prossimo?"
            : "Crea un obiettivo di risparmio e segui i tuoi progressi."}
        </p>
      ) : (
        <ul className="grid gap-4">
          {active.slice(0, 3).map((g) => (
            <li key={g.id} className="grid gap-2">
              <div className="flex items-center gap-2">
                <CategoryIcon name={g.icon} color={g.color} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</span>
                <span className="text-muted-foreground text-xs">
                  {Math.round(g.progress * 100)}%
                </span>
              </div>
              <Meter
                value={g.progress}
                color={g.color}
                label={`${g.name}: ${Math.round(g.progress * 100)}%`}
              />
              <p className="text-muted-foreground text-xs">
                {money(g.currentAmount)} di {money(g.targetAmount)}
                {g.suggestedMonthly !== null &&
                  !g.overdue &&
                  ` · ${money(g.suggestedMonthly)}/mese`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
