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
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { saveAccount } from "@/app/(dashboard)/accounts/actions";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import type { ActionResult } from "@/lib/action-result";
import type { AccountDTO } from "@/lib/dto";
import { CURRENCY_OPTIONS } from "@/lib/currency/currencies";
import { currencySymbol, useCurrency } from "@/components/currency-provider";

export function AccountFormDialog({
  account,
  trigger,
}: {
  account?: AccountDTO;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const baseCurrency = useCurrency();
  const [currency, setCurrency] = useState(account?.currency ?? baseCurrency);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  function handleOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) {
      setResult(null);
      setCurrency(account?.currency ?? baseCurrency);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await saveAccount(account?.id ?? null, {
      name: form.get("name"),
      type: form.get("type"),
      initialBalance: form.get("initialBalance"),
      currency,
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success(account ? "Conto aggiornato" : "Conto creato");
    setOpen(false);
  }

  const errors = result?.fieldErrors;
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Modifica conto" : "Nuovo conto"}</DialogTitle>
          <DialogDescription>
            Il saldo si aggiorna da solo in base alle transazioni registrate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
          <FormField
            label="Nome"
            name="name"
            defaultValue={account?.name}
            placeholder="Es. Conto Intesa"
            required
            autoFocus
            errors={errors?.name}
          />
          <SelectField
            label="Tipo"
            name="type"
            defaultValue={account?.type ?? "CHECKING"}
            errors={errors?.type}
          >
            {ACCOUNT_TYPE_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </SelectField>
          <SelectField
            label="Valuta"
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={!!account && account.transactionCount > 0}
            hint={
              account && account.transactionCount > 0
                ? "La valuta non si può cambiare dopo aver registrato dei movimenti."
                : currency !== baseCurrency
                  ? `I totali la convertono in ${baseCurrency} con il cambio BCE del giorno.`
                  : undefined
            }
            errors={errors?.currency}
          >
            {CURRENCY_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </SelectField>
          <FormField
            label={`Saldo iniziale (${currencySymbol(currency)})`}
            name="initialBalance"
            inputMode="decimal"
            defaultValue={account ? account.initialBalance.replace(".", ",") : ""}
            placeholder="0,00"
            hint="Il saldo quando inizi a usare FinTrack. Per un debito (es. carta di credito) usa un valore negativo."
            errors={errors?.initialBalance}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvataggio…" : account ? "Salva modifiche" : "Crea conto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
