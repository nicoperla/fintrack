import {
  CalendarDays,
  Gauge,
  PiggyBank,
  Sparkles,
  Store,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { CategoryIcon } from "@/lib/category-style";
import type { Insight, InsightKind, InsightTone } from "@/lib/finance/insights";
import { cn } from "@/lib/utils";

const KIND_ICONS: Partial<Record<InsightKind, LucideIcon>> = {
  pace: Gauge,
  savings: PiggyBank,
  merchant: Store,
  weekend: CalendarDays,
  "no-spend": Sparkles,
  "price-up": TrendingUp,
};

const TONE: Record<InsightTone, { label: string; className: string }> = {
  positive: { label: "Buona notizia", className: "bg-(--delta-good)" },
  negative: { label: "Da tenere d'occhio", className: "bg-(--delta-bad)" },
  neutral: { label: "Curiosità", className: "bg-muted-foreground/40" },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const Icon = KIND_ICONS[insight.kind];
  const tone = TONE[insight.tone];
  return (
    <li className="bg-card relative flex gap-3 overflow-hidden rounded-xl border p-4">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", tone.className)} />
      {insight.category ? (
        <CategoryIcon name={insight.category.icon} color={insight.category.color} />
      ) : (
        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
          {Icon && <Icon className="text-muted-foreground size-4" aria-hidden />}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{tone.label}</p>
        <p className="text-sm leading-snug">{insight.text}</p>
      </div>
    </li>
  );
}

export function InsightList({ insights, limit }: { insights: Insight[]; limit?: number }) {
  const shown = limit ? insights.slice(0, limit) : insights;
  if (shown.length === 0) {
    return (
      <p className="bg-card text-muted-foreground rounded-xl border p-6 text-center text-sm">
        Registra qualche movimento in più: appena ci saranno abbastanza dati per un confronto, qui
        troverai i tuoi insight.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </ul>
  );
}
