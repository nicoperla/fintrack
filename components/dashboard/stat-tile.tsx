import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { AnimatedCurrency } from "@/components/dashboard/animated-currency";
import { percentChange } from "@/lib/finance/dashboard-math";
import { cn } from "@/lib/utils";

type StatTileProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  /** The tile's colour: a glowing line on top and the icon's badge. */
  accent?: string;
  /** Previous period value; the delta is shown when it's a meaningful baseline. */
  previous?: number;
  previousLabel?: string;
  /** Whether an increase is good news (income) or bad news (expenses). */
  upIsGood?: boolean;
  footnote?: React.ReactNode;
  /** A last line under the comparison (e.g. the amount in working time). */
  extra?: React.ReactNode;
};

const percent = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

export function StatTile({
  label,
  value,
  icon: Icon,
  accent = "var(--primary)",
  previous,
  previousLabel,
  upIsGood = true,
  footnote,
  extra,
}: StatTileProps) {
  const change = previous === undefined ? null : percentChange(value, previous);
  const rounded = change === null ? null : Math.round(change);
  const isUp = (rounded ?? 0) > 0;
  const good = isUp === upIsGood;
  const DeltaIcon = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="bg-card relative flex flex-col gap-3 overflow-hidden rounded-xl border p-4">
      <span
        aria-hidden
        className="absolute inset-x-6 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full opacity-25 blur-2xl"
        style={{ background: accent }}
      />
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <span
          className="flex size-7 items-center justify-center rounded-lg"
          style={{ color: accent, background: `color-mix(in oklab, ${accent} 15%, transparent)` }}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </div>
      <AnimatedCurrency
        value={value}
        className="font-display text-[1.7rem] leading-tight font-semibold tracking-tight tabular-nums"
      />
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
      {extra}
    </div>
  );
}
