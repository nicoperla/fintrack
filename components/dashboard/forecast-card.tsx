"use client";

import { AlertTriangle, CalendarClock, TrendingDown } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
import type { ForecastData } from "@/lib/data/forecast";
import { cn } from "@/lib/utils";

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const tickDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longDate = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const axisNumber = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Round axis ticks (0, 500, 1.000…) that cover [min, max] in about four steps. */
function niceAxis(min: number, max: number) {
  const raw = (max - min || 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= Math.ceil(max / step) * step + 1e-9; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }
  return { ticks };
}

function ForecastTooltip({ active, payload }: TooltipContentProps) {
  const money = useMoney();
  const point = payload?.[0]?.payload as { date: string; balance: number } | undefined;
  if (!active || !point) return null;
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 rounded-lg px-3 py-2 text-xs shadow-md ring-1">
      <p className="text-muted-foreground">{longDate.format(parse(point.date))}</p>
      <p className="font-medium tabular-nums">{money(point.balance)}</p>
    </div>
  );
}

/**
 * Where the everyday accounts are heading in the next weeks, and a warning before they dip
 * below zero.
 */
export function ForecastCard({ data }: { data: ForecastData }) {
  const money = useMoney();
  const hidden = useAmountsHidden();
  const reduceMotion = usePrefersReducedMotion();

  const start = data.points[0].balance;
  const negative = data.low.balance < 0;
  // "Tight": the lowest point leaves less than a week of the usual spending.
  const tight = !negative && data.low.balance < data.dailySpend * 7;
  const lowIsToday = data.low.date === data.points[0].date;
  const upcoming = data.events.slice(0, 5);
  const values = data.points.map((p) => p.balance);
  const axis = niceAxis(Math.min(0, ...values), Math.max(...values));
  const min = axis.ticks[0];

  return (
    <section className="bg-card grid gap-4 rounded-xl border p-4" aria-labelledby="forecast-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="forecast-title" className="flex items-center gap-2 font-medium">
            <CalendarClock className="size-4" aria-hidden /> I prossimi 45 giorni
          </h2>
          <p className="text-muted-foreground text-sm">{data.accounts.join(", ")}</p>
        </div>
        <p className="text-right text-sm">
          <span className="text-muted-foreground block text-xs">Tra 45 giorni</span>
          <span className="font-medium tabular-nums">{money(data.end)}</span>
        </p>
      </div>

      {(negative || tight) && !lowIsToday ? (
        <p
          className={cn(
            "flex items-start gap-2 rounded-lg p-3 text-sm",
            negative
              ? "bg-(--delta-bad)/10 text-(--delta-bad)"
              : "bg-amber-500/10 text-(--warn-text)",
          )}
          role={negative ? "alert" : undefined}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {negative ? "Occhio: " : "Margine stretto: "}
            {longDate.format(parse(data.low.date))} i conti di tutti i giorni scendono a{" "}
            <span className="font-medium tabular-nums">{money(data.low.balance)}</span>
            {negative ? ". Sposta qualcosa dai risparmi o rimanda una spesa." : "."}
          </span>
        </p>
      ) : (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <TrendingDown className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Il punto più basso sarà {lowIsToday ? "oggi" : longDate.format(parse(data.low.date))}:{" "}
            <span className="text-foreground font-medium tabular-nums">
              {money(data.low.balance)}
            </span>
            .
          </span>
        </p>
      )}

      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--viz-income)" stopOpacity={0.16} />
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
              width={44}
              domain={[axis.ticks[0], axis.ticks[axis.ticks.length - 1]]}
              ticks={axis.ticks}
              tickFormatter={(v: number) => (hidden ? "" : axisNumber.format(v))}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            {min < 0 && <ReferenceLine y={0} stroke="var(--delta-bad)" strokeDasharray="4 4" />}
            <Tooltip
              content={ForecastTooltip}
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Area
              type="stepAfter"
              dataKey="balance"
              stroke="var(--viz-income)"
              strokeWidth={2}
              fill="url(#forecast-fill)"
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={!reduceMotion}
              animationDuration={700}
            />
            <ReferenceDot
              x={data.low.date}
              y={data.low.balance}
              r={4.5}
              fill={negative ? "var(--delta-bad)" : "var(--viz-income)"}
              stroke="var(--card)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {upcoming.length > 0 && (
        <ul className="divide-y text-sm">
          {upcoming.map((e) => (
            <li key={`${e.date}-${e.name}`} className="flex items-center gap-3 py-1.5">
              <span className="text-muted-foreground w-16 shrink-0 text-xs">
                {tickDate.format(parse(e.date)).replace(".", "")}
              </span>
              <span className="min-w-0 flex-1 truncate">{e.name}</span>
              <span
                className={cn(
                  "shrink-0 font-medium tabular-nums",
                  e.amount > 0 && "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {e.amount > 0 ? "+" : "−"}
                {money(Math.abs(e.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-xs">
        Stima: saldo di oggi {money(start)}, entrate e uscite ricorrenti nei loro giorni e circa{" "}
        {money(data.dailySpend)} al giorno di spese abituali. Esclusi risparmi e investimenti.
      </p>
    </section>
  );
}
