"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField, TextareaField } from "@/components/forms/form-field";
import { saveTransaction } from "@/app/(dashboard)/transactions/actions";
import { todayDateInputValue } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import type { AccountOption, CategoryOption, TransactionDTO } from "@/lib/dto";
import { cn } from "@/lib/utils";

type TxType = "EXPENSE" | "INCOME" | "TRANSFER";

const TYPE_TABS: { value: TxType; label: string }[] = [
  { value: "EXPENSE", label: "Uscita" },
  { value: "INCOME", label: "Entrata" },
  { value: "TRANSFER", label: "Trasferimento" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionDTO | null;
  /** Initial values for a new transaction (e.g. from quick entry); saving creates a new one. */
  prefill?: TransactionDTO | null;
  onSaved?: () => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
  onDelete?: (transaction: TransactionDTO) => void;
};

export function TransactionFormDialog(props: Props) {
  // Remounting the form on every open resets all fields to the transaction being edited.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        {props.open && <TransactionForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function TransactionForm({
  onOpenChange,
  transaction,
  prefill,
  accounts,
  categories,
  onDelete,
  onSaved,
}: Props) {
  const initial = transaction ?? prefill;
  const [type, setType] = useState<TxType>(initial?.type ?? "EXPENSE");
  const [categoryId, setCategoryId] = useState(initial?.category?.id ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  const categoriesForType = categories.filter((c) => c.type === type);

  function changeType(next: TxType) {
    setType(next);
    const stillValid = categories.some(
      (c) =>
        c.type === next && (c.id === categoryId || c.children.some((ch) => ch.id === categoryId)),
    );
    if (!stillValid) setCategoryId("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await saveTransaction(transaction?.id ?? null, {
      type,
      amount: form.get("amount"),
      date: form.get("date"),
      description: form.get("description"),
      accountId: form.get("accountId"),
      transferAccountId: form.get("transferAccountId") ?? "",
      categoryId: type === "TRANSFER" ? "" : categoryId,
      notes: form.get("notes"),
      tags: form.get("tags"),
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success(transaction ? "Movimento aggiornato" : "Movimento registrato");
    res.warnings?.forEach((w) => toast.warning(w, { duration: 7000 }));
    onSaved?.();
    onOpenChange(false);
  }

  const errors = result?.fieldErrors;
  const defaultAccount = initial?.account.id ?? accounts[0]?.id ?? "";
  const defaultDestination =
    initial?.transferAccount?.id ?? accounts.find((a) => a.id !== defaultAccount)?.id ?? "";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{transaction ? "Modifica movimento" : "Nuovo movimento"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}

        <div
          role="radiogroup"
          aria-label="Tipo di movimento"
          className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1"
        >
          {TYPE_TABS.map((tab) => (
            <label
              key={tab.value}
              className={cn(
                "has-focus-visible:ring-ring/50 cursor-pointer rounded-md py-1.5 text-center text-sm transition-colors has-focus-visible:ring-3",
                type === tab.value
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              <input
                type="radio"
                name="type"
                value={tab.value}
                checked={type === tab.value}
                onChange={() => changeType(tab.value)}
                className="sr-only"
              />
              {tab.label}
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Importo (€)"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={initial ? initial.amount.replace(".", ",") : ""}
            autoFocus={!transaction}
            className="text-lg font-medium tabular-nums"
            errors={errors?.amount}
          />
          <FormField
            label="Data"
            name="date"
            type="date"
            defaultValue={initial?.date ?? todayDateInputValue()}
            errors={errors?.date}
          />
        </div>

        <FormField
          label={type === "TRANSFER" ? "Descrizione (facoltativa)" : "Descrizione"}
          name="description"
          placeholder={type === "TRANSFER" ? "Trasferimento" : "Es. Spesa Esselunga"}
          defaultValue={initial?.description}
          maxLength={120}
          errors={errors?.description}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label={type === "TRANSFER" ? "Dal conto" : "Conto"}
            name="accountId"
            defaultValue={defaultAccount}
            errors={errors?.accountId}
          >
            {accounts.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.name}
              </NativeSelectOption>
            ))}
          </SelectField>

          {type === "TRANSFER" ? (
            <SelectField
              key="transferAccountId"
              label="Al conto"
              name="transferAccountId"
              defaultValue={defaultDestination}
              errors={errors?.transferAccountId}
            >
              {accounts.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name}
                </NativeSelectOption>
              ))}
            </SelectField>
          ) : (
            <SelectField
              key="categoryId"
              label="Categoria"
              name="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              errors={errors?.categoryId}
            >
              <NativeSelectOption value="">Senza categoria</NativeSelectOption>
              {categoriesForType.map((c) => [
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>,
                ...c.children.map((ch) => (
                  <NativeSelectOption key={ch.id} value={ch.id}>
                    {`   ↳ ${ch.name}`}
                  </NativeSelectOption>
                )),
              ])}
            </SelectField>
          )}
        </div>

        <FormField
          label="Tag"
          name="tags"
          placeholder="Es. vacanza, lavoro"
          defaultValue={initial?.tags.join(", ")}
          hint="Separati da virgola."
          errors={errors?.tags}
        />

        <TextareaField
          label="Note"
          name="notes"
          defaultValue={initial?.notes ?? ""}
          maxLength={500}
          rows={2}
          errors={errors?.notes}
        />

        <DialogFooter className="sm:justify-between">
          {transaction && onDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onDelete(transaction)}
              disabled={pending}
            >
              <Trash2 data-icon="inline-start" />
              Elimina
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvataggio…" : transaction ? "Salva modifiche" : "Registra"}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </>
  );
}
