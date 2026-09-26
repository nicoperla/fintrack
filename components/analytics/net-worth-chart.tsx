"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  Area,
  AreaChart,
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

type NetWorth = {
  series: { date: string; value: number }[];
  current: number;
  change: number;
  changePct: number | null;
  assets: number;
  liabilities: number;
};

const RANGES = [
  ["3m", "3M", "negli ultimi 3 mesi"],
  ["6m", "6M", "negli ultimi 6 mesi"],
  ["1a", "1A", "nell'ultimo anno"],
  ["tutto", "Tutto", "da quando usi FinTrack"],
] as const;

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
const axisNumber = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const percent = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

function NetWorthTooltip({ active, payload }: TooltipContentProps) {
  const money = useMoney();
  const point = payload?.[0]?.payload as { date: string; value: number } | undefined;
  if (!active || !point) return null;
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 rounded-lg px-3 py-2 text-xs shadow-md ring-1">
      <p className="text-muted-foreground">{fullDate.format(parse(point.date))}</p>
      <p className="font-medium tabular-nums">{money(point.value)}</p>
    </div>
  );
}

export function NetWorthChart({
  data,
  range,
  query,
}: {
  data: NetWorth;
  range: (typeof RANGES)[number][0];
  query: Record<string, string>;
}) {
  const money = useMoney();
  const reduceMotion = usePrefersReducedMotion();
  const up = data.change >= 0;
  const DeltaIcon = up ? ArrowUpRight : ArrowDownRight;
  const rangeText = RANGES.find(([key]) => key === range)?.[2] ?? "";
  const values = data.series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, Math.abs(max) * 0.01, 1);
  const last = data.series.at(-1);

  return (
    <section
      className="bg-card flex flex-col gap-4 rounded-xl border p-4"
      aria-labelledby="networth-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="networth-title" className="font-medium">
            Patrimonio netto nel tempo
          </h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{money(data.current)}</p>
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <span
              className={cn(
                "flex items-center font-medium",
                up ? "text-(--delta-good)" : "text-(--delta-bad)",
              )}
            >
              <DeltaIcon className="size-3.5" aria-hidden />
              {up ? "+" : "−"}
              {money(Math.abs(data.change))}
              {data.changePct !== null &&
                ` (${up ? "+" : "−"}${percent.format(Math.abs(data.changePct))}%)`}
            </span>
            {rangeText}
          </p>
        </div>
        <nav aria-label="Periodo" className="bg-muted flex rounded-lg p-0.5 text-xs">
          {RANGES.map(([key, label]) => (
            <Link
              key={key}
              href={`/insights?${new URLSearchParams({ ...query, range: key })}`}
              scroll={false}
              aria-current={range === key ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                range === key ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="networth-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--viz-income)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--viz-income)" stopOpacity={0.02} />
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
              tickFormatter={(v: number) => axisNumber.format(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickCount={4}
            />
            <Tooltip
              content={NetWorthTooltip}
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--viz-income)"
              strokeWidth={2}
              fill="url(#networth-fill)"
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                props.index === data.series.length - 1 && last ? (
                  <circle
                    key="end"
                    cx={props.cx}
                    cy={props.cy}
                    r={4.5}
                    fill="var(--viz-income)"
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                ) : (
                  <g key={props.index} />
                )
              }
              isAnimationActive={!reduceMotion}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">Attività (conti in positivo)</dt>
          <dd className="font-medium">{money(data.assets)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Passività (es. carte di credito)</dt>
          <dd className="font-medium">{money(data.liabilities)}</dd>
        </div>
      </dl>
    </section>
  );
}
