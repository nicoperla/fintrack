import Link from "next/link";
import { ChevronRight, RefreshCw, TrendingUp } from "lucide-react";
import { Amount } from "@/components/amount";
import { AnimatedCurrency } from "@/components/dashboard/animated-currency";
import { AllocationBar, GainBadge, ValueSparkline } from "@/components/investments/investment-bits";
import { downsample } from "@/lib/finance/investments";
import type { Investments } from "@/lib/data/investments";

/** The last year at most, in about sixty points: enough for the shape. */
const SPARK_DAYS = 365;
const SPARK_POINTS = 60;

/**
 * The investments, right under the money you can spend but kept apart from it: what they're worth,
 * the gain on what was put in, how it went and how it's split. The whole card opens the
 * investments page.
 */
export function InvestmentsCard({ data }: { data: Investments }) {
  if (!data.total) return null;
  const { total, accounts, series, staleCount } = data;
  const points = downsample(series.slice(-SPARK_DAYS), SPARK_POINTS);

  return (
    <Link
      href="/investments"
      className="bg-card group relative grid gap-4 overflow-hidden rounded-2xl border p-5 transition-[translate,border-color,box-shadow] duration-300 hover:-translate-y-0.5 sm:p-6"
    >
      <span
        aria-hidden
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <TrendingUp className="size-4" aria-hidden />
            </span>
            Investimenti
            <span className="hidden sm:inline">· a parte dai soldi disponibili</span>
          </p>
          <AnimatedCurrency
            value={total.value}
            className="font-display text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl"
          />
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <GainBadge gain={total.gain} pct={total.gainPct} />
            <span className="text-muted-foreground">
              su <Amount value={total.invested} /> versati
            </span>
          </p>
        </div>
        {staleCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-(--warn-text)">
            <RefreshCw className="size-3.5" aria-hidden />
            Aggiorna il valore
          </span>
        ) : (
          <ChevronRight
            className="text-muted-foreground size-5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </div>

      {points.length > 1 && (
        <div className="grid gap-1.5">
          <ValueSparkline id="dash-investments" points={points} className="h-20 sm:h-24" />
          <div className="text-muted-foreground flex gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4 rounded-full bg-(--primary)" />
              Valore
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="w-4 border-t-[1.5px] border-dashed border-(--viz-ref)" />
              Versato
            </span>
          </div>
        </div>
      )}

      <AllocationBar slices={accounts} />
    </Link>
  );
}
