"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Info,
  PiggyBank,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { Input } from "@/components/ui/input";
import { useAmountsHidden, useMoney, useSpaceInfo } from "@/components/currency-provider";
import {
  checkAffordability,
  type AffordReason,
  type AffordVerdict,
} from "@/lib/finance/affordability";
import { parseQuickEntry, type QuickEntryContext } from "@/lib/quick-entry/parse";
import type { ForecastData } from "@/lib/data/forecast";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

export type AffordData = {
  forecast: ForecastData | null;
  savingsBalance: number;
  monthlySaved: number;
  goals: { name: string; remaining: number }[];
  budgetFor: Record<string, { name: string; amount: number; spent: number }>;
  quickContext: QuickEntryContext;
};

const VERDICT_STYLE: Record<AffordVerdict, { icon: LucideIcon; color: string; bg: string }> = {
  yes: { icon: CircleCheck, color: "var(--delta-good)", bg: "bg-(--delta-good)/10" },
  tight: { icon: CircleAlert, color: "var(--meter-warn)", bg: "bg-amber-500/10" },
  savings: { icon: PiggyBank, color: "var(--meter-warn)", bg: "bg-amber-500/10" },
  no: { icon: CircleX, color: "var(--delta-bad)", bg: "bg-(--delta-bad)/10" },
};

const REASON_ICON: Record<AffordReason["kind"], { icon: LucideIcon; className: string }> = {
  good: { icon: CircleCheck, className: "text-(--delta-good)" },
  warn: { icon: CircleAlert, className: "text-(--warn-text)" },
  bad: { icon: CircleX, className: "text-(--delta-bad)" },
  info: { icon: Info, className: "text-muted-foreground" },
};

const tickDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function AffordTooltip({ active, payload }: TooltipContentProps) {
  const money = useMoney();
  const point = payload?.[0]?.payload as
    { date: string; balance: number; after: number } | undefined;
  if (!active || !point) return null;
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 rounded-lg px-3 py-2 text-xs shadow-md ring-1">
      <p className="text-muted-foreground">
        {tickDate.format(new Date(`${point.date}T00:00:00Z`))}
      </p>
      <p className="tabular-nums">Senza: {money(point.balance)}</p>
      <p className="font-medium tabular-nums">Con l&apos;acquisto: {money(point.after)}</p>
    </div>
  );
}

const EXAMPLES = ["cuffie 199", "weekend a Roma 350", "palestra 45 al mese", "iPhone 1.100"];

/** "Can I afford it?": type a purchase, get a verdict as you type. */
export function AffordCard({ data }: { data: AffordData }) {
  const money = useMoney();
  const hidden = useAmountsHidden();
  const { workRate } = useSpaceInfo();
  const reduceMotion = usePrefersReducedMotion();
  const [text, setText] = useState("");
  const [monthlyChoice, setMonthlyChoice] = useState<boolean | null>(null);
  const deferred = useDeferredValue(text);

  const parsed = useMemo(
    () => (deferred.trim() ? parseQuickEntry(deferred, data.quickContext) : null),
    [deferred, data.quickContext],
  );
  // "al mese", "mensile", "abbonamento": a recurring cost, unless the user picked otherwise.
  const saysMonthly = /al mese|mensil|abbonament|\brata\b|ogni mese/i.test(deferred);
  const monthly = monthlyChoice ?? saysMonthly;
  const amount = parsed?.amount ? Number(parsed.amount) : 0;

  const result = useMemo(() => {
    if (!data.forecast || !amount) return null;
    return checkAffordability(
      {
        amount,
        monthly,
        points: data.forecast.points,
        events: data.forecast.events,
        dailySpend: data.forecast.dailySpend,
        savingsBalance: data.savingsBalance,
        monthlySaved: data.monthlySaved,
        goals: data.goals,
        budget: parsed?.categoryId ? (data.budgetFor[parsed.categoryId] ?? null) : null,
        workRate: hidden ? null : workRate,
      },
      money,
    );
  }, [amount, monthly, data, parsed?.categoryId, money, workRate, hidden]);

  const style = result ? VERDICT_STYLE[result.verdict] : null;

  return (
    <section className="bg-card grid gap-4 rounded-2xl border p-5" aria-labelledby="afford-title">
      <div>
        <h2 id="afford-title" className="flex items-center gap-2 font-medium">
          <ShoppingBag className="size-4" aria-hidden /> Posso permettermelo?
        </h2>
        <p className="text-muted-foreground text-sm">
          Scrivi cosa vuoi comprare e quanto costa: controllo saldo futuro, obiettivi, budget e
          quanto lavoro ti costa.
        </p>
      </div>

      {data.forecast ? (
        <>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Es. «bici elettrica 890» o «Netflix 13,99 al mese»"
              aria-label="Cosa vuoi comprare e quanto costa"
              className="h-10"
            />
            <div
              className="bg-muted inline-flex rounded-lg p-1 text-sm"
              role="group"
              aria-label="Frequenza"
            >
              {[
                { value: false, label: "Una volta" },
                { value: true, label: "Ogni mese" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={monthly === o.value}
                  onClick={() => setMonthlyChoice(o.value)}
                  className={cn(
                    "rounded-md px-3 py-1 transition-colors",
                    monthly === o.value
                      ? "bg-background font-medium shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {!text.trim() && (
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setText(example)}
                  className="hover:bg-muted text-muted-foreground rounded-full border px-3 py-1 text-xs transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          )}

          {text.trim() && !amount && (
            <p className="text-muted-foreground text-sm">
              Aggiungi il prezzo, es. «{text.trim()} 120».
            </p>
          )}

          {result && style && (
            <div className="grid gap-4" aria-live="polite">
              <div className={cn("flex items-center gap-3 rounded-xl p-3", style.bg)}>
                <style.icon
                  className="size-7 shrink-0"
                  style={{ color: style.color }}
                  aria-hidden
                />
                <div>
                  <p className="text-lg font-semibold" style={{ color: style.color }}>
                    {result.title}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {parsed?.description ? `${parsed.description}: ` : ""}
                    {money(amount)}
                    {monthly ? " al mese" : ""}
                  </p>
                </div>
              </div>

              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) =>
                        tickDate.format(new Date(`${d}T00:00:00Z`)).replace(".", "")
                      }
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      minTickGap={40}
                    />
                    <YAxis hide domain={["auto", "auto"]} />
                    <ReferenceLine y={0} stroke="var(--delta-bad)" strokeDasharray="4 4" />
                    <Tooltip content={AffordTooltip} isAnimationActive={false} />
                    <Area
                      type="stepAfter"
                      dataKey="balance"
                      stroke="var(--viz-other)"
                      strokeDasharray="4 3"
                      fill="none"
                      isAnimationActive={false}
                    />
                    <Area
                      type="stepAfter"
                      dataKey="after"
                      stroke={style.color}
                      strokeWidth={2}
                      fill={style.color}
                      fillOpacity={0.08}
                      isAnimationActive={!reduceMotion}
                      animationDuration={500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-muted-foreground -mt-2 text-xs">
                Linea tratteggiata: i tuoi conti senza l&apos;acquisto. Linea piena: con
                l&apos;acquisto.
              </p>

              <ul className="grid gap-2">
                {result.reasons.map((reason) => {
                  const r = REASON_ICON[reason.kind];
                  return (
                    <li key={reason.text} className="flex gap-2 text-sm">
                      <r.icon className={cn("mt-0.5 size-4 shrink-0", r.className)} aria-hidden />
                      <span>{reason.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Aggiungi un conto corrente, una carta o i contanti per usare questa funzione.
        </p>
      )}
    </section>
  );
}
