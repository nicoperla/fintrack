"use client";

import { useState, type FormEvent } from "react";
import { Hourglass } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { useAmountsHidden, useMoney, useCurrencySymbol } from "@/components/currency-provider";
import { formatWorkTime, workRate } from "@/lib/finance/work-time";
import { parseAmount } from "@/lib/finance/money";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { updateWorkSettings } from "./actions";

type Props = {
  manualIncome: number | null;
  estimatedIncome: number | null;
  weeklyHours: number;
  enabled: boolean;
};

export function WorkTimeForm({ manualIncome, estimatedIncome, weeklyHours, enabled }: Props) {
  const money = useMoney();
  const symbol = useCurrencySymbol();
  const hidden = useAmountsHidden();
  const [income, setIncome] = useState(manualIncome ? String(manualIncome).replace(".", ",") : "");
  const [hours, setHours] = useState(String(weeklyHours));
  const [on, setOn] = useState(enabled);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  // Live example with what's typed, falling back to the estimate like the app does.
  const typed = parseAmount(income);
  const monthly = typed ? Number(typed) : estimatedIncome;
  const rate = monthly ? workRate(monthly, Number(hours)) : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const res = await updateWorkSettings({
      monthlyNetIncome: income,
      workHoursPerWeek: hours,
      showWorkTime: on,
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setPending(false);
    setResult(res);
    if (res.ok) toast.success("Impostazioni salvate");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="work-label" className="flex items-center gap-2 font-medium">
            <Hourglass className="size-4" aria-hidden /> Il prezzo in ore di lavoro
          </p>
          <p className="text-muted-foreground text-sm">
            Accanto alle spese ti mostro quanto tempo del tuo lavoro valgono.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="work-label"
          onClick={() => setOn(!on)}
          className={cn(
            "focus-visible:ring-ring/50 relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-3",
            on ? "bg-primary" : "bg-input",
          )}
        >
          <span
            className={cn(
              "bg-background size-5 rounded-full shadow-sm transition-transform",
              on ? "translate-x-5.5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
      {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label={`Entrate nette al mese (${symbol})`}
          name="monthlyNetIncome"
          inputMode="decimal"
          value={income}
          onChange={(e) => setIncome(e.target.value)}
          placeholder={estimatedIncome && !hidden ? String(Math.round(estimatedIncome)) : "1850"}
          hint={
            estimatedIncome
              ? `Vuoto: uso la media delle entrate che hai registrato (${money(estimatedIncome)}).`
              : "Lo stipendio netto che ricevi ogni mese."
          }
          errors={result?.fieldErrors?.monthlyNetIncome}
        />
        <FormField
          label="Ore di lavoro a settimana"
          name="workHoursPerWeek"
          inputMode="numeric"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          errors={result?.fieldErrors?.workHoursPerWeek}
        />
      </div>
      {on && rate && (
        <p className="text-muted-foreground text-sm">
          Guadagni circa {money(rate.hourly)} l&apos;ora: una cena da {money(60)} vale{" "}
          {formatWorkTime(60, rate)} di lavoro.
        </p>
      )}
      <Button type="submit" variant="outline" className="justify-self-start" disabled={pending}>
        {pending ? "Salvataggio…" : "Salva"}
      </Button>
    </form>
  );
}
