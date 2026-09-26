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
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { saveBudget } from "@/app/(dashboard)/budgets/actions";
import type { ActionResult } from "@/lib/action-result";
import type { CategoryOption } from "@/lib/dto";

export type EditableBudget = {
  id: string;
  categoryId: string;
  amount: number;
  alertThreshold: number;
};

export function BudgetFormDialog({
  budget,
  categories,
  usedCategoryIds,
  trigger,
}: {
  budget?: EditableBudget;
  categories: CategoryOption[];
  usedCategoryIds: string[];
  trigger: React.ReactElement;
}) {
  const symbol = useCurrencySymbol();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  const available = (id: string) => id === budget?.categoryId || !usedCategoryIds.includes(id);
  const options = categories
    .filter((c) => c.type === "EXPENSE")
    .flatMap((c) => [
      { id: c.id, label: c.name },
      ...c.children.map((ch) => ({ id: ch.id, label: `   ↳ ${ch.name}` })),
    ])
    .filter((o) => available(o.id));

  function handleOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) setResult(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await saveBudget(budget?.id ?? null, {
      categoryId: form.get("categoryId"),
      amount: form.get("amount"),
      alertThreshold: form.get("alertThreshold"),
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success(budget ? "Budget aggiornato" : "Budget creato");
    setOpen(false);
  }

  const errors = result?.fieldErrors;
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{budget ? "Modifica budget" : "Nuovo budget mensile"}</DialogTitle>
          <DialogDescription>
            Un budget su una categoria principale include anche le sue sottocategorie.
          </DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <FormMessage tone="error">
            Tutte le categorie di uscita hanno già un budget. Crea una nuova categoria per
            aggiungerne un altro.
          </FormMessage>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
            <SelectField
              label="Categoria"
              name="categoryId"
              defaultValue={budget?.categoryId ?? options[0]?.id}
              errors={errors?.categoryId}
            >
              {options.map((o) => (
                <NativeSelectOption key={o.id} value={o.id}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </SelectField>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label={`Limite mensile (${symbol})`}
                name="amount"
                inputMode="decimal"
                placeholder="250"
                defaultValue={budget ? String(budget.amount).replace(".", ",") : ""}
                autoFocus
                errors={errors?.amount}
              />
              <FormField
                label="Avvisami al (%)"
                name="alertThreshold"
                type="number"
                min={1}
                max={100}
                step={1}
                defaultValue={budget?.alertThreshold ?? 80}
                errors={errors?.alertThreshold}
              />
            </div>
            <p className="text-muted-foreground -mt-2 text-xs">
              Quando la spesa del mese raggiunge questa percentuale del limite ricevi un avviso.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvataggio…" : budget ? "Salva modifiche" : "Crea budget"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
