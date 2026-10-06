"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { currencySymbol, useAmountsHidden } from "@/components/currency-provider";
import { saveValuation } from "@/app/(dashboard)/investments/actions";
import type { ActionResult } from "@/lib/action-result";
import { todayDateInputValue } from "@/lib/format";

/** "Aggiorna valore": what the account is worth today (or on another day), from the broker's app. */
export function ValuationDialog({
  account,
  trigger,
}: {
  account: { id: string; name: string; currency: string; value: number };
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const hidden = useAmountsHidden();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) setResult(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await saveValuation({
      accountId: account.id,
      value: form.get("value"),
      date: form.get("date"),
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success(`Valore di ${account.name} aggiornato`);
    setOpen(false);
  }

  const errors = result?.fieldErrors;
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiorna il valore</DialogTitle>
          <DialogDescription>
            Quanto vale oggi «{account.name}»? Copialo dall&apos;app della banca o del broker:
            FinTrack calcola da solo guadagno o perdita su quello che hai versato.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <FormField
              label={`Valore (${currencySymbol(account.currency)})`}
              name="value"
              inputMode="decimal"
              // The last value as a hint, unless amounts are hidden.
              placeholder={hidden ? "0,00" : account.value.toFixed(2).replace(".", ",")}
              required
              autoFocus
              className="text-lg font-medium tabular-nums"
              errors={errors?.value}
            />
            <FormField
              label="Al giorno"
              name="date"
              type="date"
              defaultValue={todayDateInputValue()}
              max={todayDateInputValue()}
              errors={errors?.date}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvataggio…" : "Salva valore"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
