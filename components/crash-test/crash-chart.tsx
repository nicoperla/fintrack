"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useAmountsHidden, useMoney } from "@/components/currency-provider";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import type { Tone } from "@/lib/finance/crash-test";

const monthShort = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const axisNumber = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const TONE_COLORS: Record<Tone, string> = {
  ok: "var(--delta-good)",
  warn: "#d97706",
  danger: "var(--delta-bad)",
};

/** Month `index` after `start` ("YYYY-MM"), as a date. */
export const monthAt = (start: string, index: number) => {
  const [year, month] = start.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + index, 1));
};

/** Round ticks (0, 5.000, 10.000…) that cover [min, max] in about four steps. */
function niceTicks(min: number, max: number) {
  const raw = (max - min || 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= Math.ceil(max / step) * step + 1e-9; t += step) {
    ticks.push(Math.round(t));
  }
  return ticks;
}

type Point = { index: number; label: string; scenario: number | null; baseline: number };

function ChartTooltip({ active, payload }: TooltipContentProps) {
  const money = useMoney();
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 grid gap-0.5 rounded-lg px-3 py-2 text-xs shadow-md ring-1">
      <p className="text-muted-foreground">{point.label}</p>
      <p className="font-medium tabular-nums">
        {point.scenario === null ? "Soldi finiti" : `Con lo scenario: ${money(point.scenario)}`}
      </p>
      <p className="text-muted-foreground tabular-nums">Senza: {money(point.baseline)}</p>
    </div>
  );
}

/**
 * The money at hand month by month, with the scenario and without it, and the point where it
 * runs out.
 */
export function CrashChart({
  start,
  scenario,
  baseline,
  held,
  tone,
}: {
  start: string;
  scenario: number[];
  baseline: number[];
  held: number | null;
  tone: Tone;
}) {
  const hidden = useAmountsHidden();
  const reduceMotion = usePrefersReducedMotion();
  const runOut = held !== null ? Math.min(scenario.length - 1, Math.ceil(held)) : null;
  // Past the month the money runs out the line stops: what comes after would be debt.
  const shown = scenario.map((value, index) => (runOut !== null && index > runOut ? null : value));
  const points: Point[] = shown.map((value, index) => ({
    index,
    label: index === 0 ? "Oggi" : monthLong.format(monthAt(start, index)),
    scenario: value,
    baseline: baseline[index],
  }));
  const values = [...shown.filter((v): v is number => v !== null), ...baseline];
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  const color = TONE_COLORS[tone];

  return (
    <div
      className="h-56 w-full"
      role="img"
      aria-label="Andamento dei soldi a disposizione, mese per mese"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="index"
            type="number"
            domain={[0, scenario.length - 1]}
            ticks={[0, 6, 12, 18, 24, 30, 36].filter((t) => t < scenario.length)}
            tickFormatter={(i: number) => {
              if (i === 0) return "oggi";
              const d = monthAt(start, i);
              return `${monthShort.format(d).replace(".", "")} ${String(d.getUTCFullYear()).slice(2)}`;
            }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickMargin={8}
          />
          <YAxis
            width={44}
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
            tickFormatter={(v: number) => (hidden ? "" : axisNumber.format(v))}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.6} />
          <Tooltip
            content={ChartTooltip}
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="baseline"
            stroke="var(--viz-other)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="scenario"
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={!reduceMotion}
            animationDuration={700}
          />
          {runOut !== null && (
            <ReferenceDot
              x={runOut}
              y={scenario[runOut]}
              r={5}
              fill={color}
              stroke="var(--card)"
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
