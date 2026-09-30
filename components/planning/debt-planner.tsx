"use client";

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
import { AlertTriangle, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DebtFormDialog } from "@/components/planning/debt-form-dialog";
import { SliderField } from "@/components/planning/slider-field";
import { deleteDebt } from "@/app/(dashboard)/debts/actions";
import { simulatePayoff, type DebtInput, type Strategy } from "@/lib/finance/debts";
import { useMoney, useAmountsHidden, useWholeMoney } from "@/components/currency-provider";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

const STRATEGIES: { key: Strategy; name: string; color: string; description: string }[] = [
  {
    key: "avalanche",
    name: "Valanga",
    color: "var(--viz-income)",
    description: "Prima il tasso più alto: paghi meno interessi.",
  },
  {
    key: "snowball",
    name: "Palla di neve",
    color: "var(--viz-expense)",
    description: "Prima il debito più piccolo: chiudi subito qualcosa e resti motivato.",
  },
];

const monthYear = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
const axisNumber = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function monthFromNow(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return monthYear.format(d);
}

function duration(months: number) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && (y === 1 ? "1 anno" : `${y} anni`), m && (m === 1 ? "1 mese" : `${m} mesi`)]
    .filter(Boolean)
    .join(" e ");
}

function BalanceTooltip({ active, payload }: TooltipContentProps) {
  const money0 = useWholeMoney();
  const point = payload?.[0]?.payload as
    { month: number; avalanche?: number; snowball?: number } | undefined;
  if (!active || !point) return null;
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 grid min-w-44 gap-1 rounded-lg px-3 py-2 text-xs shadow-md ring-1">
      <p className="font-medium capitalize">{monthFromNow(point.month)}</p>
      {STRATEGIES.map((s) => (
        <div key={s.key} className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3 rounded" style={{ backgroundColor: s.color }} />
          <span className="text-muted-foreground">{s.name}</span>
          <span className="ml-auto font-medium tabular-nums">{money0(point[s.key] ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

function DebtRow({ debt }: { debt: DebtInput }) {
  const money = useMoney();
  const [confirm, setConfirm] = useState(false);
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-2 font-medium">{debt.name}</td>
      <td className="py-2 pr-2 text-right tabular-nums">{money(debt.balance)}</td>
      <td className="py-2 pr-2 text-right tabular-nums">{debt.apr.toLocaleString("it-IT")}%</td>
      <td className="py-2 pr-2 text-right tabular-nums">{money(debt.minPayment)}</td>
      <td className="py-2 text-right whitespace-nowrap">
        <DebtFormDialog
          debt={debt}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Modifica ${debt.name}`}>
              <Pencil />
            </Button>
          }
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Elimina ${debt.name}`}
          onClick={() => setConfirm(true)}
        >
          <Trash2 />
        </Button>
        <ConfirmDeleteDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={`Eliminare "${debt.name}"?`}
          description="Verrà rimosso dal piano di rientro. I tuoi movimenti non vengono toccati."
          successMessage="Debito eliminato"
          onConfirm={() => deleteDebt(debt.id)}
        />
      </td>
    </tr>
  );
}

export function DebtPlanner({ debts }: { debts: DebtInput[] }) {
  const money0 = useWholeMoney();
  const hidden = useAmountsHidden();
  const money = useMoney();
  const reduceMotion = usePrefersReducedMotion();
  const [extra, setExtra] = useState(100);
  const [strategy, setStrategy] = useState<Strategy>("avalanche");

  const results = useMemo(
    () => ({
      avalanche: simulatePayoff(debts, extra, "avalanche"),
      snowball: simulatePayoff(debts, extra, "snowball"),
    }),
    [debts, extra],
  );
  const chosen = results[strategy];
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const minimums = debts.reduce((s, d) => s + d.minPayment, 0);
  const interestSaved = results.snowball.totalInterest - results.avalanche.totalInterest;

  const chartData = useMemo(() => {
    const length = Math.max(results.avalanche.balances.length, results.snowball.balances.length);
    return Array.from({ length }, (_, month) => ({
      month,
      avalanche: results.avalanche.balances[month] ?? 0,
      snowball: results.snowball.balances[month] ?? 0,
    }));
  }, [results]);

  const addButton = (
    <Button size="sm">
      <Plus data-icon="inline-start" />
      Aggiungi debito
    </Button>
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <section className="bg-card grid gap-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">I tuoi debiti</h2>
            <p className="text-muted-foreground text-sm">
              Totale {money(totalDebt)} · rate minime {money(minimums)}/mese
            </p>
          </div>
          <DebtFormDialog trigger={addButton} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr className="border-b">
                <th className="py-2 pr-2 font-medium">Debito</th>
                <th className="py-2 pr-2 text-right font-medium">Residuo</th>
                <th className="py-2 pr-2 text-right font-medium">TAN</th>
                <th className="py-2 pr-2 text-right font-medium">Rata minima</th>
                <th className="py-2" aria-label="Azioni" />
              </tr>
            </thead>
            <tbody>
              {debts.map((d) => (
                <DebtRow key={d.id} debt={d} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-card grid gap-5 rounded-xl border p-4">
        <SliderField
          label="Quanto puoi aggiungere ogni mese oltre alle rate minime?"
          value={extra}
          onChange={setExtra}
          min={0}
          max={1000}
          step={25}
          format={(v) => `+${money0(v)}/mese`}
          hint={`Budget mensile per i debiti: ${money0(minimums + extra)}. Quando chiudi un debito, la sua rata passa al successivo.`}
        />

        <div role="radiogroup" aria-label="Strategia" className="grid gap-3 sm:grid-cols-2">
          {STRATEGIES.map((s) => {
            const r = results[s.key];
            const selected = strategy === s.key;
            return (
              <label
                key={s.key}
                className={cn(
                  "has-focus-visible:ring-ring/50 relative grid cursor-pointer gap-2 rounded-xl border p-4 transition-colors has-focus-visible:ring-3",
                  selected ? "border-foreground/40 bg-muted/40" : "hover:bg-muted/30",
                )}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={s.key}
                  checked={selected}
                  onChange={() => setStrategy(s.key)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 font-medium">
                  <span
                    aria-hidden
                    className="h-0.5 w-4 rounded"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.name}
                  {s.key === "avalanche" && interestSaved > 1 && (
                    <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] font-normal">
                      più conveniente
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">{s.description}</span>
                {r.feasible ? (
                  <span className="text-sm">
                    Libero da debiti a{" "}
                    <span className="font-semibold">{monthFromNow(r.months)}</span>
                    <span className="text-muted-foreground"> · {duration(r.months)}</span>
                    <br />
                    Interessi totali{" "}
                    <span className="font-semibold tabular-nums">{money(r.totalInterest)}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-(--delta-bad)">
                    <AlertTriangle className="size-4" aria-hidden />
                    Con queste rate il debito non scende
                  </span>
                )}
              </label>
            );
          })}
        </div>
        {chosen.feasible && interestSaved > 1 && (
          <p className="text-muted-foreground -mt-2 text-xs">
            Con la valanga risparmi {money(interestSaved)} di interessi rispetto alla palla di neve.
          </p>
        )}
      </section>

      {chosen.feasible && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="bg-card grid gap-4 rounded-xl border p-4">
            <div>
              <h2 className="font-medium">Debito residuo nel tempo</h2>
              <div className="mt-2 flex gap-4 text-xs">
                {STRATEGIES.map((s) => (
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
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(m: number) => (m === 0 ? "Oggi" : `${m} m`)}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    minTickGap={24}
                    tickMargin={8}
                  />
                  <YAxis
                    width={44}
                    tickFormatter={(v: number) => (hidden ? "" : axisNumber.format(v))}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickCount={4}
                  />
                  <Tooltip
                    content={BalanceTooltip}
                    cursor={{ stroke: "var(--muted-foreground)" }}
                    isAnimationActive={false}
                  />
                  {/* The selected strategy is drawn last so it stays visible where the lines overlap. */}
                  {[
                    ...STRATEGIES.filter((s) => s.key !== strategy),
                    ...STRATEGIES.filter((s) => s.key === strategy),
                  ].map((s) => (
                    <Line
                      key={s.key}
                      dataKey={s.key}
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

          <section className="bg-card grid content-start gap-4 rounded-xl border p-4">
            <div>
              <h2 className="font-medium">
                Ordine di estinzione · {STRATEGIES.find((s) => s.key === strategy)?.name}
              </h2>
              <p className="text-muted-foreground text-sm">Quando chiudi ogni debito</p>
            </div>
            <ol className="grid gap-4">
              {chosen.payoffs.map((p, i) => (
                <li key={p.id} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="bg-muted flex size-5 items-center justify-center rounded-full text-[11px]">
                        {i + 1}
                      </span>
                      {p.name}
                    </span>
                    <span className="text-muted-foreground text-xs capitalize">
                      {monthFromNow(p.month)}
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${(p.month / chosen.months) * 100}%`,
                        backgroundColor: STRATEGIES.find((s) => s.key === strategy)?.color,
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {duration(p.month)} · interessi {money(p.interest)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="flex items-center gap-2 border-t pt-3 text-sm">
              <Trophy className="size-4 text-(--delta-good)" aria-hidden />
              Totale pagato {money(chosen.totalPaid)}, di cui {money(chosen.totalInterest)} di
              interessi.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
