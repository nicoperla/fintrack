"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { HandCoins, Trash2 } from "lucide-react";
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
import {
  currencySymbol,
  useSpaceInfo,
  useAmountsHidden,
  useWorkTime,
} from "@/components/currency-provider";
import { parseAmount } from "@/lib/finance/money";
import { maskAmounts } from "@/components/amount";
import { saveOrQueue } from "@/lib/offline/save";

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
  const [accountId, setAccountId] = useState(initial?.account.id ?? accounts[0]?.id ?? "");
  const [destinationId, setDestinationId] = useState(
    initial?.transferAccount?.id ?? accounts.find((a) => a.id !== accountId)?.id ?? "",
  );
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const { userId, spaceId } = useSpaceInfo();
  const amountsHidden = useAmountsHidden();
  const workTimeOf = useWorkTime();
  const [amountText, setAmountText] = useState(initial?.amount.replace(".", ",") ?? "");

  const currencyOf = (id: string) => accounts.find((a) => a.id === id)?.currency ?? "EUR";
  const sourceCurrency = currencyOf(accountId);
  const destinationCurrency = currencyOf(destinationId);
  const crossCurrency = type === "TRANSFER" && sourceCurrency !== destinationCurrency;
  const typedAmount = parseAmount(amountText);
  const workTime =
    type === "EXPENSE" && typedAmount ? workTimeOf(Number(typedAmount), sourceCurrency) : null;
  const workHint = workTime ? `Sono ${workTime} del tuo lavoro.` : null;

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
    if (transaction && !navigator.onLine) {
      setPending(false);
      setResult({
        ok: false,
        error: "Sei offline: le modifiche si salvano solo con la connessione.",
      });
      return;
    }
    const text = (name: string) => String(form.get(name) ?? "");
    const input = {
      type,
      amount: text("amount"),
      date: text("date"),
      description: text("description"),
      accountId,
      transferAccountId: type === "TRANSFER" ? destinationId : "",
      transferAmount: crossCurrency ? text("transferAmount") : "",
      categoryId: type === "TRANSFER" ? "" : categoryId,
      notes: text("notes"),
      tags: text("tags"),
    };
    const failed = (): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." });
    // New movements can be recorded offline too: they wait in the outbox until the next sync.
    const res: ActionResult & { queued?: boolean } = transaction
      ? await saveTransaction(transaction.id, input).catch(failed)
      : await saveOrQueue(input, { userId, spaceId }, input.description || "Movimento").catch(
          failed,
        );
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success(
      res.queued
        ? "Salvato offline: lo sincronizzo appena torni online"
        : transaction
          ? "Movimento aggiornato"
          : "Movimento registrato",
    );
    res.warnings?.forEach((w) =>
      toast.warning(amountsHidden ? maskAmounts(w) : w, { duration: 7000 }),
    );
    onSaved?.();
    onOpenChange(false);
  }

  const errors = result?.fieldErrors;

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
            label={`Importo (${currencySymbol(sourceCurrency)})`}
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={initial ? initial.amount.replace(".", ",") : ""}
            onChange={(e) => setAmountText(e.target.value)}
            autoFocus={!transaction}
            className="text-lg font-medium tabular-nums"
            hint={workHint ?? undefined}
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
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
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
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
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

        {crossCurrency && (
          <FormField
            label={`Ricevuti sul conto di destinazione (${currencySymbol(destinationCurrency)})`}
            name="transferAmount"
            inputMode="decimal"
            placeholder="Calcolato con il cambio del giorno"
            defaultValue={initial?.transferAmount?.replace(".", ",") ?? ""}
            hint="Lascialo vuoto per usare il cambio BCE della data; scrivi l'importo esatto se lo conosci (commissioni comprese)."
            errors={errors?.transferAmount}
          />
        )}

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

        {transaction?.type === "EXPENSE" && (
          <Link
            href={`/ritrovati/pratiche/nuova?movimento=${transaction.id}`}
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 justify-self-start text-sm underline-offset-4 hover:underline"
          >
            <HandCoins className="size-4" aria-hidden />
            Contesta questo addebito
          </Link>
        )}

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
