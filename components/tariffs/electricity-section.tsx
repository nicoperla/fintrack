"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, Zap } from "lucide-react";
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
import { FormField, FormMessage } from "@/components/forms/form-field";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { onDate, toDate } from "@/components/true-salary/format";
import {
  Card,
  Moves,
  Section,
  VerdictBadge,
  VerdictBox,
  formatKwh,
  fromDate,
  useKwhPrice,
  type Move,
} from "@/components/tariffs/tariff-ui";
import {
  deleteTariffCheck,
  saveElectricityBill,
} from "@/app/(dashboard)/ritrovati/tariffometro/actions";
import { COMPARATORS, ELECTRICITY } from "@/lib/finance/tariff-data";
import type { Tariffometro } from "@/lib/data/tariffs";
import type { ActionResult } from "@/lib/action-result";

type BillItem = Tariffometro["bills"][number];
type Editing = {
  id?: string;
  label: string;
  amount: string;
  kwh: string;
  periodFrom: string;
  periodTo: string;
  renewsOn: string;
};

const failed = (): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." });
const toInput = (n: number) => n.toFixed(2).replace(".", ",");

/** "dall'1 luglio al 31 agosto 2026", with both years when they differ. */
function periodText(from: string, to: string) {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${fromDate(from)}${sameYear ? "" : ` ${from.slice(0, 4)}`} ${toDate(to)} ${to.slice(0, 4)}`;
}

export function ElectricitySection({ data }: { data: Tariffometro }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null);

  const add = () =>
    setEditing({
      label: data.bills.length === 0 ? "Luce di casa" : "",
      amount: "",
      kwh: "",
      periodFrom: "",
      periodTo: "",
      renewsOn: "",
    });

  return (
    <Section
      id="luce"
      icon={Zap}
      title="Luce"
      subtitle="Quanto ti costa ogni kWh, tutto compreso, contro il prezzo di riferimento dell'ARERA per lo stesso periodo."
      action={
        data.bills.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus /> Un&apos;altra fornitura
          </Button>
        )
      }
    >
      {data.bills.length === 0 ? (
        <Card className="justify-items-start">
          <p className="text-sm">
            Prendi l&apos;ultima bolletta della luce: mi bastano il totale, i kWh e il periodo. Ti
            dico quanto paghi ogni kWh e come sei messo rispetto al prezzo di riferimento.
          </p>
          <Button type="button" onClick={add}>
            <Plus /> Aggiungi la bolletta
          </Button>
        </Card>
      ) : (
        data.bills.map((bill) => (
          <BillCard
            key={bill.id}
            bill={bill}
            data={data}
            onEdit={() =>
              setEditing({
                id: bill.id,
                label: bill.label,
                amount: toInput(bill.amount),
                kwh: String(bill.kwh),
                periodFrom: bill.from,
                periodTo: bill.to,
                renewsOn: bill.renewsOn ?? "",
              })
            }
            onDelete={() => setDeleting({ id: bill.id, label: bill.label })}
          />
        ))
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          {editing && (
            <BillForm key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Togliere «${deleting?.label ?? ""}»?`}
        description="Tolgo la bolletta dal Tariffometro e non ti ricordo più la scadenza del prezzo."
        successMessage="Bolletta tolta"
        onConfirm={() =>
          deleting ? deleteTariffCheck(deleting.id) : Promise.resolve({ ok: true })
        }
      />
    </Section>
  );
}

function BillCard({
  bill,
  data,
  onEdit,
  onDelete,
}: {
  bill: BillItem;
  data: Tariffometro;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const money = useMoney();
  const kwhPrice = useKwhPrice();
  const c = bill.comparison;
  const pct = c?.reference ? Math.round(Math.abs(c.price / c.reference - 1) * 100) : 0;
  const renewal = data.renewals.find((r) => r.id === bill.id);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{bill.label}</p>
          <p className="text-muted-foreground text-sm">
            {money(bill.amount)} per {formatKwh(bill.kwh)}, {periodText(bill.from, bill.to)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            aria-label={`Aggiorna ${bill.label}`}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label={`Togli ${bill.label}`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {renewal && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-(--warn-text)">
          Il prezzo bloccato scade{" "}
          {renewal.days === 0
            ? "oggi"
            : renewal.days === 1
              ? "domani"
              : `tra ${renewal.days} giorni`}
          : controlla cosa ti hanno scritto sulle nuove condizioni e confronta le offerte.
        </p>
      )}

      {!c ? (
        <p className="bg-muted/40 rounded-xl p-3 text-sm">
          I prezzi dell&apos;ARERA sono in euro: il confronto vale per gli spazi in euro.
        </p>
      ) : c.reference === null || c.verdict === null ? (
        <p className="bg-muted/40 rounded-xl p-3 text-sm">
          La bolletta costa {kwhPrice(c.price)} tutto compreso. Per questo periodo non ho il prezzo
          di riferimento dell&apos;ARERA: confronto le bollette{" "}
          {fromDate(ELECTRICITY.quarters[0].from)} {ELECTRICITY.quarters[0].from.slice(0, 4)} in
          poi.
        </p>
      ) : (
        <>
          <VerdictBox verdict={c.verdict}>
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {c.verdict === "inline"
                ? `Paghi ${kwhPrice(c.price)}, in linea con il riferimento dell'ARERA.`
                : `Paghi ${kwhPrice(c.price)}: il ${pct}% ${c.verdict === "above" ? "in più" : "in meno"} del riferimento dell'ARERA.`}
              <VerdictBadge verdict={c.verdict} reference />
            </p>
            <p className="text-muted-foreground">
              Consumi circa {formatKwh(c.yearlyKwh)} l&apos;anno
              {c.verdict === "above"
                ? `: a questo prezzo sono circa ${money(c.over)} l'anno più del riferimento.`
                : `, per circa ${money(c.yearlyCost)} l'anno.`}
            </p>
          </VerdictBox>
          <PriceBars price={c.price} reference={c.reference} />
          {c.consumption !== "typical" && (
            <p className="text-muted-foreground text-xs">
              {c.consumption === "low"
                ? `Il riferimento è calcolato su ${formatKwh(ELECTRICITY.typicalKwh)} l'anno: consumando meno, le quote fisse pesano di più su ogni kWh, quindi un costo per kWh un po' più alto è normale.`
                : `Il riferimento è calcolato su ${formatKwh(ELECTRICITY.typicalKwh)} l'anno: consumando di più, le quote fisse pesano meno su ogni kWh, quindi il tuo costo per kWh tende a essere più basso.`}
            </p>
          )}
        </>
      )}

      {bill.renewsOn && !renewal && bill.renewsOn > data.today && (
        <p className="text-muted-foreground text-sm">
          Il prezzo bloccato scade {onDate(bill.renewsOn)}: ti avviso io un mese prima.
        </p>
      )}

      <Moves open={c?.verdict === "above" || renewal !== undefined} moves={billMoves(bill)} />
    </Card>
  );
}

function PriceBars({ price, reference }: { price: number; reference: number }) {
  const kwhPrice = useKwhPrice();
  const max = Math.max(price, reference) * 1.1;
  const rows = [
    { label: "La tua bolletta", value: price, mask: true, className: "bg-primary" },
    {
      label: "Riferimento ARERA",
      value: reference,
      mask: false,
      className: "bg-foreground/35",
    },
  ];
  return (
    <div
      className="grid gap-2 text-xs"
      role="img"
      aria-label={`La tua bolletta: ${kwhPrice(price)}. Riferimento ARERA: ${kwhPrice(reference, false)}.`}
    >
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[8.5rem_1fr] items-center gap-2">
          <span className="text-muted-foreground">{r.label}</span>
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 rounded-full ${r.className}`}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
            <span className="shrink-0 tabular-nums">{kwhPrice(r.value, r.mask)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function billMoves(bill: BillItem): Move[] {
  const yearly = bill.comparison?.yearlyKwh;
  const moves: Move[] = [
    {
      text: `Confronta le offerte sul Portale Offerte, il comparatore pubblico dell'ARERA${yearly ? `: scrivi che consumi circa ${formatKwh(yearly)} l'anno` : ""}.`,
      href: COMPARATORS.electricity.url,
      linkLabel: "Apri il Portale Offerte",
    },
    {
      text: "Cambiare fornitore è gratis e non serve disdire: ci pensa il nuovo. Dal 1° dicembre 2026, dopo le verifiche, il passaggio si completa in 24 ore lavorative.",
    },
  ];
  if (!bill.renewsOn) {
    moves.push({
      text: "Hai un prezzo bloccato? Segna quando scade: ti avviso io un mese prima, perché dopo il prezzo cambia.",
    });
  }
  return moves;
}

function BillForm({ initial, onDone }: { initial: Editing; onDone: () => void }) {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const errors = result?.fieldErrors;
  const set = (key: keyof Editing) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await saveElectricityBill(form).catch(failed);
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success(form.id ? "Bolletta aggiornata" : "Bolletta aggiunta: ecco il confronto");
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {form.id ? "Aggiorna la bolletta" : "Aggiungi la bolletta della luce"}
        </DialogTitle>
        <DialogDescription>
          Copia i numeri dall&apos;ultima bolletta: il totale, i kWh fatturati e il periodo a cui si
          riferiscono.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <FormField
          label="Nome"
          name="label"
          placeholder="Es. Luce di casa"
          maxLength={40}
          value={form.label}
          onChange={set("label")}
          errors={errors?.label}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Totale della bolletta (€)"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            value={form.amount}
            onChange={set("amount")}
            hint="Senza il canone Rai, se c'è: non è energia."
            className="tabular-nums"
            errors={errors?.amount}
          />
          <FormField
            label="kWh fatturati"
            name="kwh"
            inputMode="numeric"
            placeholder="Es. 330"
            value={form.kwh}
            onChange={set("kwh")}
            hint="Il consumo del periodo."
            className="tabular-nums"
            errors={errors?.kwh}
          />
          <FormField
            label="Dal"
            name="periodFrom"
            type="date"
            value={form.periodFrom}
            onChange={set("periodFrom")}
            errors={errors?.periodFrom}
          />
          <FormField
            label="Al"
            name="periodTo"
            type="date"
            value={form.periodTo}
            onChange={set("periodTo")}
            hint="Il periodo dei consumi, non la data della bolletta."
            errors={errors?.periodTo}
          />
        </div>
        <FormField
          label="Il prezzo bloccato scade il"
          name="renewsOn"
          type="date"
          value={form.renewsOn}
          onChange={set("renewsOn")}
          hint="Facoltativo, se hai un prezzo fisso: ti avviso io un mese prima."
          errors={errors?.renewsOn}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            Annulla
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Un attimo…" : form.id ? "Salva" : "Confronta"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
