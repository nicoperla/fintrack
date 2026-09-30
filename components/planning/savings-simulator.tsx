"use client";

import { useAmountsHidden, useWholeMoney } from "@/components/currency-provider";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { Flag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SliderField } from "@/components/planning/slider-field";
import { CategoryIcon } from "@/lib/category-style";
import { monthsToReach, projectBalance } from "@/lib/finance/projection";
import { parseSignedAmount } from "@/lib/finance/money";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";

type Goal = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  remaining: number;
  targetDate: string | null;
};

const SERIES = [
  { key: "base", name: "Continuando così", color: "var(--muted-foreground)" },
  { key: "extra", name: "Con il risparmio extra", color: "var(--viz-income)" },
] as const;

const axisNumber = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const monthYear = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });

function monthLabel(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return monthYear.format(d);
}

function durationLabel(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(years === 1 ? "1 anno" : `${years} anni`);
  if (rest) parts.push(rest === 1 ? "1 mese" : `${rest} mesi`);
  return parts.join(" e ") || "subito";
}

function SimTooltip({ active, payload }: TooltipContentProps) {
  const money0 = useWholeMoney();
  const point = payload?.[0]?.payload as { month: number; base: number; extra: number } | undefined;
  if (!active || !point) return null;
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 grid min-w-48 gap-1 rounded-lg px-3 py-2 text-xs shadow-md ring-1">
      <p className="font-medium capitalize">{monthLabel(point.month)}</p>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3 rounded" style={{ backgroundColor: s.color }} />
          <span className="text-muted-foreground">{s.name}</span>
          <span className="ml-auto font-medium tabular-nums">{money0(point[s.key])}</span>
        </div>
      ))}
    </div>
  );
}

export function SavingsSimulator({
  netWorth,
  averageMonthlySavings,
  goals,
}: {
  netWorth: number;
  averageMonthlySavings: number;
  goals: Goal[];
}) {
  const money0 = useWholeMoney();
  const hidden = useAmountsHidden();
  const reduceMotion = usePrefersReducedMotion();
  const [startText, setStartText] = useState(String(Math.max(0, Math.round(netWorth))));
  const [monthly, setMonthly] = useState(
    Math.min(3000, Math.round(averageMonthlySavings / 25) * 25),
  );
  const [extra, setExtra] = useState(200);
  const [rate, setRate] = useState(2);
  const [years, setYears] = useState(3);

  const start = Math.max(0, Number(parseSignedAmount(startText) ?? 0));
  const months = years * 12;

  const data = useMemo(() => {
    const base = projectBalance(start, monthly, rate, months);
    const withExtra = projectBalance(start, monthly + extra, rate, months);
    return base.map((value, month) => ({ month, base: value, extra: withExtra[month] }));
  }, [start, monthly, extra, rate, months]);

  const finalBase = data[data.length - 1].base;
  const finalExtra = data[data.length - 1].extra;
  const contributed = extra * months;
  const growth = finalExtra - finalBase - contributed;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <section
        className="bg-card grid content-start gap-5 rounded-xl border p-4"
        aria-label="Parametri"
      >
        <div className="grid gap-2">
          <Label htmlFor="sim-start">Punto di partenza</Label>
          <Input
            id="sim-start"
            inputMode="decimal"
            value={startText}
            onChange={(e) => setStartText(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Di default è il tuo patrimonio netto attuale.
          </p>
        </div>
        <SliderField
          label="Risparmio mensile attuale"
          value={monthly}
          onChange={setMonthly}
          min={0}
          max={3000}
          step={25}
          format={money0}
          hint={`La media degli ultimi 3 mesi è ${money0(averageMonthlySavings)}.`}
        />
        <SliderField
          label="E se risparmiassi in più…"
          value={extra}
          onChange={setExtra}
          min={0}
          max={1000}
          step={25}
          format={(v) => `+${money0(v)}/mese`}
        />
        <SliderField
          label="Rendimento annuo"
          value={rate}
          onChange={setRate}
          min={0}
          max={8}
          step={0.5}
          format={(v) => `${v.toLocaleString("it-IT")}%`}
          hint="0% se tieni tutto sul conto; 2–4% è un'ipotesi prudente per un investimento."
        />
        <SliderField
          label="Orizzonte"
          value={years}
          onChange={setYears}
          min={1}
          max={30}
          step={1}
          format={(v) => (v === 1 ? "1 anno" : `${v} anni`)}
        />
      </section>

      <div className="grid content-start gap-6">
        <section className="bg-card grid gap-4 rounded-xl border p-4" aria-live="polite">
          <div>
            <p className="text-muted-foreground text-sm">
              Tra {years === 1 ? "un anno" : `${years} anni`} avresti
            </p>
            <p className="text-4xl font-semibold tracking-tight">{money0(finalExtra)}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {extra > 0 ? (
                <>
                  <span className="text-foreground font-medium">
                    +{money0(finalExtra - finalBase)}
                  </span>{" "}
                  rispetto a continuare così ({money0(finalBase)}): {money0(contributed)} li metti
                  tu
                  {growth > 1 && <>, {money0(growth)} arrivano dai rendimenti</>}.
                </>
              ) : (
                "Sposta il cursore del risparmio extra per vedere la differenza."
              )}
            </p>
          </div>

          <div className="flex gap-4 text-xs">
            {SERIES.map((s) => (
              <span key={s.key} className="text-muted-foreground flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-0.5 w-4 rounded"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </span>
            ))}
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  type="number"
                  domain={[0, months]}
                  ticks={Array.from({ length: Math.min(years, 10) + 1 }, (_, i) =>
                    Math.round((i * months) / Math.min(years, 10)),
                  )}
                  tickFormatter={(m: number) =>
                    m === 0 ? "Oggi" : `${Math.round((m / 12) * 10) / 10} a`
                  }
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickMargin={8}
                />
                <YAxis
                  width={48}
                  tickFormatter={(v: number) => (hidden ? "" : axisNumber.format(v))}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickCount={5}
                />
                <Tooltip
                  content={SimTooltip}
                  cursor={{ stroke: "var(--muted-foreground)" }}
                  isAnimationActive={false}
                />
                {SERIES.map((s) => (
                  <Line
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                    isAnimationActive={!reduceMotion}
                    animationDuration={600}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {goals.length > 0 && (
          <section className="bg-card grid gap-3 rounded-xl border p-4">
            <div>
              <h2 className="flex items-center gap-2 font-medium">
                <Flag className="text-muted-foreground size-4" aria-hidden />I tuoi obiettivi
              </h2>
              <p className="text-muted-foreground text-xs">
                Se destinassi a ciascun obiettivo tutto il risparmio mensile.
              </p>
            </div>
            <ul className="grid gap-2">
              {goals.map((g) => {
                const now = monthsToReach(g.remaining, 0, monthly, rate);
                const faster = monthsToReach(g.remaining, 0, monthly + extra, rate);
                return (
                  <li key={g.id} className="flex items-center gap-3 text-sm">
                    <CategoryIcon name={g.icon} color={g.color} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
                    <span className="text-muted-foreground text-right text-xs">
                      {faster === null ? (
                        "Aumenta il risparmio per raggiungerlo"
                      ) : (
                        <>
                          <span className="text-foreground font-medium">
                            {durationLabel(faster)}
                          </span>
                          {extra > 0 &&
                            now !== null &&
                            now > faster &&
                            ` invece di ${durationLabel(now)}`}
                          {extra > 0 && now === null && " (senza extra non ci arrivi)"}
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
