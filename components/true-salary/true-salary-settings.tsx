"use client";

import { useState, type FormEvent } from "react";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrencySymbol } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { saveTrueSalarySettings } from "@/app/(dashboard)/stipendio-vero/actions";
import { onDay } from "@/components/true-salary/format";
import type { TrueSalaryData } from "@/lib/data/true-salary";
import type { ActionResult } from "@/lib/action-result";

const toInput = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));

export function TrueSalarySettings({ data }: { data: TrueSalaryData }) {
  const symbol = useCurrencySymbol();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const { settings, detectedSalary } = data;
  const errors = result?.fieldErrors;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    setPending(true);
    const res = await saveTrueSalarySettings({
      payday: text("payday"),
      thirteenth: text("thirteenth"),
      fourteenth: text("fourteenth"),
      reserveAccountId: text("reserveAccountId"),
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setPending(false);
    setResult(res.ok ? null : res);
    if (res.ok) toast.success("Impostazioni salvate: ho ricalcolato lo stipendio vero");
  }

  return (
    <section
      aria-labelledby="impostazioni-title"
      className="bg-card grid grid-cols-1 gap-4 rounded-2xl border p-5"
    >
      <div>
        <h2 id="impostazioni-title" className="flex items-center gap-2 font-medium">
          <Settings2 className="size-4" aria-hidden /> Come funziona il tuo anno
        </h2>
        <p className="text-muted-foreground text-sm">
          Valgono per tutto lo spazio: se lo condividi, anche per chi è con te.
        </p>
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <FormField
          label="Giorno dello stipendio"
          name="payday"
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          placeholder={detectedSalary ? String(detectedSalary.day) : "27"}
          defaultValue={settings.payday ?? ""}
          className="w-28"
          hint={
            detectedSalary
              ? `Lascialo vuoto e uso «${detectedSalary.name}», che arriva ${onDay(detectedSalary.day)}.`
              : "Senza uno stipendio tra i movimenti, faccio i conti fino a fine mese."
          }
          errors={errors?.payday}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label={`Tredicesima netta (${symbol})`}
            name="thirteenth"
            inputMode="decimal"
            placeholder="Non la conto"
            defaultValue={toInput(settings.thirteenth)}
            hint="Spalma la tredicesima: matura un po' ogni mese e arriva a dicembre, così paga le stangate mentre le metti da parte."
            errors={errors?.thirteenth}
          />
          <FormField
            label={`Quattordicesima netta (${symbol})`}
            name="fourteenth"
            inputMode="decimal"
            placeholder="Non la conto"
            defaultValue={toInput(settings.fourteenth)}
            hint="Solo se il tuo contratto la prevede: arriva a luglio."
            errors={errors?.fourteenth}
          />
        </div>
        <SelectField
          label="Dove metti da parte i soldi delle stangate"
          name="reserveAccountId"
          defaultValue={settings.reserveAccountId ?? ""}
          hint="Se li sposti su un conto a parte, li conto da lì e non li tolgo una seconda volta."
          errors={errors?.reserveAccountId}
        >
          <NativeSelectOption value="">Restano sui conti di tutti i giorni</NativeSelectOption>
          {data.reserveOptions.map((a) => (
            <NativeSelectOption key={a.id} value={a.id}>
              {a.name}
            </NativeSelectOption>
          ))}
        </SelectField>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvataggio…" : "Salva"}
          </Button>
        </div>
      </form>
    </section>
  );
}
