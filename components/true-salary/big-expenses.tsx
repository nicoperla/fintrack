"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, ListChecks, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  deleteBigExpense,
  markBigExpensePaid,
  saveBigExpense,
  setRecurringCounted,
  undoBigExpensePaid,
} from "@/app/(dashboard)/stipendio-vero/actions";
import {
  monthShortLabel,
  monthsText,
  ofDate,
  onDate,
  onDay,
  type LastYearAmounts,
} from "@/components/true-salary/format";
import type { TrueSalaryData } from "@/lib/data/true-salary";
import {
  BIG_EXPENSE_PRESETS,
  daysBetween,
  presetByKey,
  type BigExpensePreset,
} from "@/lib/finance/true-salary";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/** "Pagata" shows up this close to a due date. */
const MARK_PAID_DAYS = 31;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const failed = (): ActionResult => ({ ok: false, error: "Non sono riuscito a salvare. Riprova." });
const toInput = (n: number) => n.toFixed(2).replace(".", ",");

type Editing = {
  id: string | null;
  preset: string | null;
  name: string;
  amount: string;
  months: number[];
  day: string;
};

/** A new big expense from the catalog: last year's amount and months when they're known. */
function fromPreset(preset: BigExpensePreset | null, lastYear: LastYearAmounts): Editing {
  const found = preset ? lastYear[preset.key] : null;
  return {
    id: null,
    preset: preset?.key ?? null,
    name: preset?.name ?? "",
    amount: found ? toInput(found.total) : "",
    // Dates set by law stay; for the others (bollo, insurance renewal…) the months paid last year.
    months:
      preset && found && found.months.length === preset.months.length
        ? found.months
        : (preset?.months ?? []),
    day: String(preset?.day ?? 1),
  };
}

export function BigExpensesSection({
  data,
  lastYear,
}: {
  data: TrueSalaryData;
  lastYear: LastYearAmounts;
}) {
  const money = useMoney();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [pending, setPending] = useState(false);

  const added = new Set(data.bigExpenses.map((e) => e.preset).filter(Boolean));
  const toAdd = BIG_EXPENSE_PRESETS.filter((p) => !added.has(p.key));
  const found = data.reserve.items.filter((i) => i.source === "recurring");

  async function run(action: () => Promise<ActionResult>, success: string) {
    setPending(true);
    const res = await action().catch(failed);
    setPending(false);
    if (res.ok) toast.success(success);
    else toast.error(res.error ?? "Operazione non riuscita. Riprova.");
  }

  return (
    <section
      aria-labelledby="stangate-title"
      className="bg-card grid grid-cols-1 gap-4 rounded-2xl border p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="stangate-title" className="flex items-center gap-2 font-medium">
            <ListChecks className="size-4" aria-hidden /> Le tue stangate
          </h2>
          <p className="text-muted-foreground text-sm">
            Le spese grosse che tornano ogni anno: scrivi quanto hai pagato l&apos;anno scorso.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setEditing(fromPreset(null, lastYear))}>
          <Plus /> Aggiungi
        </Button>
      </div>

      {data.bigExpenses.length > 0 && (
        <ul className="divide-y text-sm">
          {data.bigExpenses.map((e) => {
            const item = data.reserve.items.find((i) => i.key === e.id);
            const paidAhead = e.paidThrough !== null && e.paidThrough >= data.today;
            const dueSoon =
              item !== undefined && daysBetween(data.today, item.nextDate) <= MARK_PAID_DAYS;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {money(e.amount)} l&apos;anno · {monthsText(e.months)}, {onDay(e.day)}
                  </p>
                  {paidAhead ? (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Pagata la rata {ofDate(e.paidThrough!)}
                    </p>
                  ) : (
                    item && (
                      <p className="text-muted-foreground text-xs">
                        Prossima: {money(item.nextAmount)} {onDate(item.nextDate)} · da parte oggi{" "}
                        {money(item.reserved)}
                      </p>
                    )
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {paidAhead ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(() => undoBigExpensePaid(e.id), "La rata torna da mettere da parte")
                      }
                    >
                      Non l&apos;ho ancora pagata
                    </Button>
                  ) : (
                    dueSoon && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={pending}
                        onClick={() => run(() => markBigExpensePaid(e.id), "Segnata come pagata")}
                      >
                        <CircleCheck /> Pagata
                      </Button>
                    )
                  )}
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Modifica ${e.name}`}
                    onClick={() =>
                      setEditing({
                        id: e.id,
                        preset: e.preset,
                        name: e.name,
                        amount: toInput(e.amount),
                        months: e.months,
                        day: String(e.day),
                      })
                    }
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Elimina ${e.name}`}
                    onClick={() => setDeleting({ id: e.id, name: e.name })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {toAdd.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          <p className="text-muted-foreground text-sm">
            {data.bigExpenses.length === 0
              ? "Spunta quelle che paghi:"
              : "Altre stangate che capitano a molti:"}
          </p>
          <ul className="flex flex-wrap gap-2">
            {toAdd.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => setEditing(fromPreset(p, lastYear))}
                  className="hover:bg-muted focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-3"
                >
                  <Plus className="size-3.5" aria-hidden /> {p.name}
                  {lastYear[p.key] && (
                    <span className="text-muted-foreground tabular-nums">
                      · {money(lastYear[p.key]!.total)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(found.length > 0 || data.ignored.length > 0) && (
        <div className="grid grid-cols-1 gap-2 border-t pt-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Repeat className="size-4" aria-hidden /> Trovate nei tuoi movimenti
          </p>
          <p className="text-muted-foreground text-xs">
            Addebiti che tornano ogni tre mesi o ogni anno: li conto da soli. Se una l&apos;hai già
            scritta tu qui sopra, non contarla due volte.
          </p>
          <ul className="divide-y text-sm">
            {found.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{r.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {money(r.nextAmount)} {onDate(r.nextDate)} · da parte oggi {money(r.reserved)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => setRecurringCounted(r.key, false), "Non la conto più")}
                >
                  Non contarla
                </Button>
              </li>
            ))}
            {data.ignored.map((r) => (
              <li
                key={r.key}
                className="text-muted-foreground flex flex-wrap items-center gap-3 py-2"
              >
                <p className="min-w-0 flex-1 truncate line-through">{r.name}</p>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => setRecurringCounted(r.key, true), "La conto di nuovo")}
                >
                  Contala di nuovo
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          {editing && (
            <BigExpenseForm
              key={editing.id ?? editing.preset ?? "new"}
              initial={editing}
              lastYear={lastYear}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Eliminare «${deleting?.name ?? ""}»?`}
        description="Non la metto più da parte e sparisce dal calendario."
        successMessage="Stangata eliminata"
        onConfirm={() => (deleting ? deleteBigExpense(deleting.id) : Promise.resolve({ ok: true }))}
      />
    </section>
  );
}

function BigExpenseForm({
  initial,
  lastYear,
  onDone,
}: {
  initial: Editing;
  lastYear: LastYearAmounts;
  onDone: () => void;
}) {
  const money = useMoney();
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const preset = presetByKey(form.preset);
  const found = preset ? lastYear[preset.key] : null;
  const errors = result?.fieldErrors;

  function choosePreset(key: string) {
    const next = fromPreset(presetByKey(key), lastYear);
    setForm({ ...next, id: form.id });
  }

  function toggleMonth(month: number) {
    setForm((f) => ({
      ...f,
      months: f.months.includes(month) ? f.months.filter((m) => m !== month) : [...f.months, month],
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await saveBigExpense(form.id, {
      preset: form.preset,
      name: form.name,
      amount: form.amount,
      months: form.months,
      day: form.day,
    }).catch(failed);
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success(form.id ? "Stangata aggiornata" : "Stangata aggiunta: la metto da parte io");
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{form.id ? "Modifica la stangata" : "Aggiungi una stangata"}</DialogTitle>
        <DialogDescription>
          Quanto costa in un anno e in che mesi la paghi: da oggi la metto da parte un po&apos; ogni
          giorno.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}

        {!form.id && (
          <SelectField
            label="Cosa"
            name="preset"
            value={form.preset ?? ""}
            onChange={(e) => choosePreset(e.target.value)}
            errors={errors?.preset}
          >
            {BIG_EXPENSE_PRESETS.map((p) => (
              <NativeSelectOption key={p.key} value={p.key}>
                {p.name}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value="">Altro (scrivi tu)</NativeSelectOption>
          </SelectField>
        )}

        {preset && (
          <p className="bg-muted/40 rounded-lg p-3 text-sm">
            {preset.hint}
            {preset.match && (
              <span className="text-muted-foreground mt-1 block">
                {found
                  ? `L'anno scorso: ${money(found.total)} in ${found.count === 1 ? "1 pagamento" : `${found.count} pagamenti`} (${monthsText(found.months)}).`
                  : "Non l'ho trovata tra i tuoi movimenti degli ultimi 12 mesi: scrivi la cifra dell'ultimo avviso."}
              </span>
            )}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Nome"
            name="name"
            value={form.name}
            maxLength={60}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            errors={errors?.name}
          />
          <FormField
            label="Quanto costa in un anno"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="tabular-nums"
            errors={errors?.amount}
          />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Label id="months-label">In che mesi la paghi</Label>
          <div
            role="group"
            aria-labelledby="months-label"
            aria-describedby={errors?.months ? "months-error" : "months-hint"}
            className="grid grid-cols-6 gap-1.5 sm:grid-cols-12"
          >
            {MONTHS.map((m) => {
              const on = form.months.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleMonth(m)}
                  className={cn(
                    "focus-visible:ring-ring/50 rounded-md border py-1.5 text-xs capitalize outline-none focus-visible:ring-3",
                    on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                  )}
                >
                  {monthShortLabel(m)}
                </button>
              );
            })}
          </div>
          {errors?.months ? (
            <p id="months-error" className="text-destructive text-sm">
              {errors.months[0]}
            </p>
          ) : (
            <p id="months-hint" className="text-muted-foreground text-xs">
              {form.months.length > 1
                ? `${form.months.length} rate uguali: ${monthsText(form.months)}.`
                : "Se la paghi a rate, scegli tutti i mesi delle rate."}
            </p>
          )}
        </div>

        <FormField
          label="Giorno della scadenza"
          name="day"
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          value={form.day}
          onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
          hint="Nei mesi più corti vale l'ultimo giorno del mese."
          className="w-28"
          errors={errors?.day}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            Annulla
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Un attimo…" : form.id ? "Salva" : "Aggiungi"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
