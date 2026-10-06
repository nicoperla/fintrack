"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useAmountsHidden, useMoney } from "@/components/currency-provider";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { downsample } from "@/lib/finance/investments";
import { cn } from "@/lib/utils";

type Point = { date: string; value: number; invested: number };

const RANGES = [
  ["6m", "6M", 183],
  ["1a", "1A", 366],
  ["tutto", "Tutto", null],
] as const;
type Range = (typeof RANGES)[number][0];

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const tickDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fullDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const axisNumber = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function LineKey({ dashed = false, color }: { dashed?: boolean; color: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "w-4 shrink-0",
        dashed ? "border-t-[1.5px] border-dashed" : "h-0.5 rounded-full",
      )}
      style={dashed ? { borderColor: color } : { background: color }}
    />
  );
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  const money = useMoney();
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  const gain = point.value - point.invested;
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 grid min-w-48 gap-1.5 rounded-lg px-3 py-2 text-xs shadow-md ring-1">
      <p className="text-muted-foreground">{fullDate.format(parse(point.date))}</p>
      <div className="flex items-center gap-2">
        <LineKey color="var(--primary)" />
        <span className="font-medium tabular-nums">{money(point.value)}</span>
        <span className="text-muted-foreground ml-auto">Valore</span>
      </div>
      <div className="flex items-center gap-2">
        <LineKey dashed color="var(--viz-ref)" />
        <span className="font-medium tabular-nums">{money(point.invested)}</span>
        <span className="text-muted-foreground ml-auto">Versato</span>
      </div>
      <div className="flex items-center gap-2 border-t pt-1.5">
        <span
          className={cn(
            "font-medium tabular-nums",
            gain > 0 && "text-(--delta-good)",
            gain < 0 && "text-(--delta-bad)",
          )}
        >
          {gain > 0 ? "+" : ""}
          {money(gain)}
        </span>
        <span className="text-muted-foreground ml-auto">{gain >= 0 ? "Guadagno" : "Perdita"}</span>
      </div>
    </div>
  );
}

/**
 * Value and money put in over time, on one scale: the gap between the two lines is the gain.
 * With a table view (end of each month) for who prefers numbers or can't see the chart.
 */
export function InvestmentChart({ series }: { series: Point[] }) {
  const hidden = useAmountsHidden();
  const money = useMoney();
  const reduceMotion = usePrefersReducedMotion();
  const [range, setRange] = useState<Range>("1a");
  const [view, setView] = useState<"chart" | "table">("chart");

  const points = useMemo(() => {
    const days = RANGES.find(([key]) => key === range)?.[2] ?? null;
    return downsample(days ? series.slice(-days) : series, 120);
  }, [series, range]);

  // The last day of each month, newest first.
  const rows = useMemo(() => {
    const byMonth = new Map<string, Point>();
    for (const p of series) byMonth.set(p.date.slice(0, 7), p);
    return Array.from(byMonth.values()).reverse().slice(0, 24);
  }, [series]);

  const values = points.flatMap((p) => [p.value, p.invested]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, Math.abs(max) * 0.01, 1);

  return (
    <section
      className="bg-card flex flex-col gap-4 rounded-2xl border p-5"
      aria-labelledby="investment-chart-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="investment-chart-title" className="font-medium">
            Valore e versato nel tempo
          </h2>
          <p className="text-muted-foreground text-sm">
            La distanza tra le due linee è il guadagno (o la perdita).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {view === "chart" && (
            <div
              role="tablist"
              aria-label="Periodo"
              className="bg-muted flex rounded-lg p-0.5 text-xs"
            >
              {RANGES.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={range === key}
                  onClick={() => setRange(key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 transition-colors",
                    range === key ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div role="tablist" aria-label="Vista" className="bg-muted flex rounded-lg p-0.5 text-xs">
            {(["chart", "table"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  view === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                )}
              >
                {v === "chart" ? "Grafico" : "Tabella"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "chart" ? (
        <>
          <div className="text-muted-foreground flex gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <LineKey color="var(--primary)" />
              Valore
            </span>
            <span className="flex items-center gap-1.5">
              <LineKey dashed color="var(--viz-ref)" />
              Versato
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="investment-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => tickDate.format(parse(d)).replace(".", "")}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  minTickGap={40}
                  tickMargin={8}
                />
                <YAxis
                  width={48}
                  domain={[min - pad, max + pad]}
                  tickFormatter={(v: number) => (hidden ? "" : axisNumber.format(v))}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickCount={4}
                />
                <Tooltip
                  content={ChartTooltip}
                  cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#investment-fill)"
                  activeDot={{ r: 5, stroke: "var(--card-solid)", strokeWidth: 2 }}
                  isAnimationActive={!reduceMotion}
                  animationDuration={900}
                />
                <Line
                  type="monotone"
                  dataKey="invested"
                  stroke="var(--viz-ref)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{
                    r: 4,
                    stroke: "var(--card-solid)",
                    strokeWidth: 2,
                    fill: "var(--viz-ref)",
                  }}
                  isAnimationActive={!reduceMotion}
                  animationDuration={900}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-card text-muted-foreground sticky top-0 text-left text-xs">
              <tr className="border-b">
                <th className="py-2 font-medium">Fine mese</th>
                <th className="py-2 text-right font-medium">Valore</th>
                <th className="py-2 text-right font-medium">Versato</th>
                <th className="py-2 text-right font-medium">Guadagno</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((p) => (
                <tr key={p.date} className="border-b last:border-0">
                  <td className="py-2 first-letter:uppercase">{monthYear.format(parse(p.date))}</td>
                  <td className="py-2 text-right">{money(p.value)}</td>
                  <td className="py-2 text-right">{money(p.invested)}</td>
                  <td className="py-2 text-right font-medium">
                    {p.value - p.invested > 0 ? "+" : ""}
                    {money(p.value - p.invested)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
