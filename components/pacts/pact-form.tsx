"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useWholeMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { createPact } from "@/app/(dashboard)/patto/actions";
import { PROMISE_MAX, REFEREE_MAX, type PactStart } from "@/lib/finance/pacts";
import type { PactsPage } from "@/lib/data/pacts";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const failed = (): ActionResult & { link?: string } => ({
  ok: false,
  error: "Salvataggio non riuscito. Riprova.",
});
const monthName = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" });
const monthOf = (today: string, offset: number) => {
  const [y, m] = today.split("-").map(Number);
  return monthName.format(new Date(Date.UTC(y, m - 1 + offset, 1)));
};

/** A new pact: the category and its limit, when, and at least one stake. */
export function PactForm({
  data,
  onDone,
}: {
  data: PactsPage;
  onDone: (link: string | null) => void;
}) {
  const whole = useWholeMoney();
  const [form, setForm] = useState({
    categoryId: "",
    limit: "",
    start: "now" as PactStart,
    onlyMine: true,
    refereeName: "",
    promise: "",
    fineAmount: "",
    goalId: data.goals.find((g) => !g.reached)?.id ?? "",
  });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const errors = result?.fieldErrors;
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const category = data.categories.find((c) => c.id === form.categoryId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await createPact({
      ...form,
      goalId: form.fineAmount.trim() ? form.goalId : "",
    }).catch(failed);
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success("Patto fatto: a fine mese controllo io");
    onDone(res.link ?? null);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Un nuovo patto</DialogTitle>
        <DialogDescription>
          Un limite che costa un po&apos; di fatica, non uno impossibile. E una posta, perché
          sforare abbia un prezzo.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Su cosa"
            name="categoryId"
            value={form.categoryId}
            onChange={set("categoryId")}
            errors={errors?.categoryId}
          >
            <NativeSelectOption value="">Scegli la categoria</NativeSelectOption>
            {data.categories.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </SelectField>
          <FormField
            label="Al massimo (€)"
            name="limit"
            inputMode="decimal"
            placeholder="Es. 150"
            value={form.limit}
            onChange={set("limit")}
            className="tabular-nums"
            errors={errors?.limit}
            hint={
              category
                ? category.lastMonth > 0
                  ? `Il mese scorso: ${whole(category.lastMonth)}.`
                  : "Il mese scorso: niente."
                : undefined
            }
          />
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Quando</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quando">
            {(
              [
                ["now", `Da oggi a fine ${monthOf(data.today, 0)}`],
                ["next-month", `Tutto ${monthOf(data.today, 1)}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.start === value}
                onClick={() => setForm((f) => ({ ...f, start: value }))}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium",
                  form.start === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {data.shared && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.onlyMine}
              onChange={(e) => setForm((f) => ({ ...f, onlyMine: e.target.checked }))}
              className="accent-primary mt-0.5 size-4"
            />
            <span>
              Conta solo le spese che registro io
              <span className="text-muted-foreground block text-xs">
                Togli la spunta per un patto di tutto lo spazio.
              </span>
            </span>
          </label>
        )}

        <fieldset className="grid gap-3 rounded-xl border p-4">
          <legend className="px-1 text-sm font-medium">La posta (almeno una)</legend>
          {errors?.stake && <FormMessage tone="error">{errors.stake[0]}</FormMessage>}
          <FormField
            label="Chi fa da arbitro"
            name="refereeName"
            placeholder="Es. Marco"
            maxLength={REFEREE_MAX}
            value={form.refereeName}
            onChange={set("refereeName")}
            errors={errors?.refereeName}
            hint="Gli mandi un link: vede il limite, quanto ne hai usato in percentuale e com'è finita. Non vede i tuoi movimenti e non serve un account."
          />
          <FormField
            label="Se perdo…"
            name="promise"
            placeholder="Es. offro la pizza a Marco"
            maxLength={PROMISE_MAX}
            value={form.promise}
            onChange={set("promise")}
            errors={errors?.promise}
          />
          {data.goals.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                label="Multa (€)"
                name="fineAmount"
                inputMode="decimal"
                placeholder="Es. 30"
                value={form.fineAmount}
                onChange={set("fineAmount")}
                className="tabular-nums"
                errors={errors?.fineAmount}
              />
              <SelectField
                label="Da mettere in"
                name="goalId"
                value={form.goalId}
                onChange={set("goalId")}
                errors={errors?.goalId}
              >
                <NativeSelectOption value="">Scegli l&apos;obiettivo</NativeSelectOption>
                {data.goals.map((g) => (
                  <NativeSelectOption key={g.id} value={g.id}>
                    {g.name}
                  </NativeSelectOption>
                ))}
              </SelectField>
              <p className="text-muted-foreground -mt-1 text-xs sm:col-span-2">
                Se perdi, metti la multa da parte in un tuo obiettivo: i soldi restano tuoi.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Con un obiettivo di risparmio potresti anche darti una multa da metterci dentro.
            </p>
          )}
        </fieldset>

        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Un attimo…" : "Faccio il patto"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
