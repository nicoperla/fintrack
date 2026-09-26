"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useMoney } from "@/components/currency-provider";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

type Point = { key: string; short: string; label: string; income: number; expense: number };

const SERIES = [
  { key: "income", name: "Entrate", color: "var(--viz-income)" },
  { key: "expense", name: "Uscite", color: "var(--viz-expense)" },
] as const;

const axisNumber = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 0,
  useGrouping: "always",
});

function Swatch({ color }: { color: string }) {
  return (
    <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
  );
}

function TrendTooltip({ active, payload }: TooltipContentProps) {
  const money = useMoney();
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  const net = point.income - point.expense;
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 grid min-w-44 gap-1.5 rounded-lg px-3 py-2 text-xs shadow-md ring-1">
      <p className="font-medium">{point.label}</p>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center gap-2">
          <Swatch color={s.color} />
          <span className="text-muted-foreground">{s.name}</span>
          <span className="ml-auto font-medium tabular-nums">{money(point[s.key])}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 border-t pt-1.5">
        <span className="text-muted-foreground">Differenza</span>
        <span className="ml-auto font-medium tabular-nums">
          {net > 0 ? "+" : ""}
          {money(net)}
        </span>
      </div>
    </div>
  );
}

export function TrendChart({ data }: { data: Point[] }) {
  const money = useMoney();
  const [view, setView] = useState<"chart" | "table">("chart");
  const reduceMotion = usePrefersReducedMotion();

  return (
    <section
      className="bg-card flex h-full flex-col gap-4 rounded-xl border p-4"
      aria-labelledby="trend-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="trend-title" className="font-medium">
            Entrate e uscite
          </h2>
          <p className="text-muted-foreground text-sm">Ultimi 6 mesi</p>
        </div>
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

      {view === "chart" ? (
        <>
          <div className="flex gap-4 text-xs">
            {SERIES.map((s) => (
              <span key={s.key} className="text-muted-foreground flex items-center gap-1.5">
                <Swatch color={s.color} />
                {s.name}
              </span>
            ))}
          </div>
          <div className="min-h-60 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                barGap={2}
                barCategoryGap="28%"
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="short"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickMargin={8}
                />
                <YAxis
                  width={52}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(v: number) => axisNumber.format(v)}
                  tickCount={5}
                />
                <Tooltip
                  content={TrendTooltip}
                  cursor={{ fill: "var(--muted)", opacity: 0.7 }}
                  isAnimationActive={false}
                />
                {SERIES.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    fill={s.color}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={!reduceMotion}
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr className="border-b">
                <th className="py-2 font-medium">Mese</th>
                <th className="py-2 text-right font-medium">Entrate</th>
                <th className="py-2 text-right font-medium">Uscite</th>
                <th className="py-2 text-right font-medium">Differenza</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {data.map((p) => (
                <tr key={p.key} className="border-b last:border-0">
                  <td className="py-2">{p.label}</td>
                  <td className="py-2 text-right">{money(p.income)}</td>
                  <td className="py-2 text-right">{money(p.expense)}</td>
                  <td className="py-2 text-right font-medium">
                    {p.income - p.expense > 0 ? "+" : ""}
                    {money(p.income - p.expense)}
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
