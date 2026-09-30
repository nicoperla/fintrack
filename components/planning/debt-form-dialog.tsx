"use client";

import { useCurrencySymbol } from "@/components/currency-provider";
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
import { saveDebt } from "@/app/(dashboard)/debts/actions";
import type { ActionResult } from "@/lib/action-result";
import type { DebtInput } from "@/lib/finance/debts";

const toInput = (n: number) => n.toFixed(2).replace(".", ",").replace(/,00$/, "");

export function DebtFormDialog({
  debt,
  trigger,
}: {
  debt?: DebtInput;
  trigger: React.ReactElement;
}) {
  const symbol = useCurrencySymbol();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) setResult(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await saveDebt(debt?.id ?? null, {
      name: form.get("name"),
      balance: form.get("balance"),
      interestRate: form.get("interestRate"),
      minimumPayment: form.get("minimumPayment"),
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success(debt ? "Debito aggiornato" : "Debito aggiunto");
    setOpen(false);
  }

  const errors = result?.fieldErrors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{debt ? "Modifica debito" : "Nuovo debito"}</DialogTitle>
          <DialogDescription>
            Prestiti, finanziamenti o carte revolving: trovi i dati nel piano di ammortamento o
            nell&apos;estratto conto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
          <FormField
            label="Nome"
            name="name"
            placeholder="Es. Prestito auto"
            defaultValue={debt?.name}
            autoFocus
            errors={errors?.name}
          />
          <FormField
            label={`Debito residuo (${symbol})`}
            name="balance"
            inputMode="decimal"
            placeholder="6.200"
            defaultValue={debt ? toInput(debt.balance) : ""}
            errors={errors?.balance}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Tasso annuo TAN (%)"
              name="interestRate"
              inputMode="decimal"
              placeholder="6,9"
              defaultValue={debt ? toInput(debt.apr) : ""}
              errors={errors?.interestRate}
            />
            <FormField
              label={`Rata minima (${symbol}/mese)`}
              name="minimumPayment"
              inputMode="decimal"
              placeholder="190"
              defaultValue={debt ? toInput(debt.minPayment) : ""}
              errors={errors?.minimumPayment}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvataggio…" : debt ? "Salva modifiche" : "Aggiungi debito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
