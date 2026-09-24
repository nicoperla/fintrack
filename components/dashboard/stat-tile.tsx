import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { AnimatedCurrency } from "@/components/dashboard/animated-currency";
import { percentChange } from "@/lib/finance/dashboard-math";
import { cn } from "@/lib/utils";

type StatTileProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Previous period value; the delta is shown when it's a meaningful baseline. */
  previous?: number;
  previousLabel?: string;
  /** Whether an increase is good news (income) or bad news (expenses). */
  upIsGood?: boolean;
  footnote?: React.ReactNode;
};

const percent = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

export function StatTile({
  label,
  value,
  icon: Icon,
  previous,
  previousLabel,
  upIsGood = true,
  footnote,
}: StatTileProps) {
  const change = previous === undefined ? null : percentChange(value, previous);
  const rounded = change === null ? null : Math.round(change);
  const isUp = (rounded ?? 0) > 0;
  const good = isUp === upIsGood;
  const DeltaIcon = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <AnimatedCurrency value={value} className="text-2xl font-semibold tracking-tight" />
      <div className="text-muted-foreground min-h-5 text-xs">
        {rounded !== null && rounded !== 0 ? (
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "flex items-center font-medium",
                good ? "text-(--delta-good)" : "text-(--delta-bad)",
              )}
            >
              <DeltaIcon className="size-3.5" aria-hidden />
              {isUp ? "+" : "−"}
              {percent.format(Math.abs(rounded))}%
            </span>
            <span>
              {isUp ? "in più" : "in meno"} rispetto a {previousLabel}
            </span>
          </span>
        ) : rounded === 0 ? (
          <span>In linea con {previousLabel}</span>
        ) : (
          footnote
        )}
      </div>
    </div>
  );
}
