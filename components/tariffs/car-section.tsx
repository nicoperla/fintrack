"use client";

import { useState, type FormEvent } from "react";
import { Car, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
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
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { onDate } from "@/components/true-salary/format";
import {
  Card,
  DistributionBar,
  Moves,
  Section,
  VerdictBadge,
  VerdictBox,
  useWholeMoney,
  type Move,
} from "@/components/tariffs/tariff-ui";
import {
  deleteTariffCheck,
  saveCarInsurance,
} from "@/app/(dashboard)/ritrovati/tariffometro/actions";
import { AGE_BANDS, AGE_BAND_LABELS, CAR_INSURANCE, COMPARATORS } from "@/lib/finance/tariff-data";
import { positionText, type CarContext } from "@/lib/finance/tariffs";
import type { Tariffometro } from "@/lib/data/tariffs";
import type { ActionResult } from "@/lib/action-result";

type CarItem = Tariffometro["cars"][number];
type Editing = {
  id?: string;
  label: string;
  premium: string;
  renewsOn: string;
  bonusMalus: string;
  ageBand: string;
};

const failed = (): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." });
const toInput = (n: number) => n.toFixed(2).replace(".", ",");
const DAY_MS = 86_400_000;
const daysUntil = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

const CLASS_GROUPS: Record<string, string> = {
  "2-3": "nelle classi 2 e 3",
  "4-10": "tra la classe 4 e la 10",
  "11-18": "tra la classe 11 e la 18",
};
const AGE_GROUPS: Record<string, string> = {
  "fino-24": "Fino a 24 anni",
  "25-34": "Tra i 25 e i 34 anni",
};

export function CarSection({ data }: { data: Tariffometro }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null);

  const add = () =>
    setEditing({
      label: data.cars.length === 0 ? "La mia auto" : "",
      premium: "",
      renewsOn: "",
      bonusMalus: "",
      ageBand: "",
    });

  return (
    <Section
      id="rc-auto"
      icon={Car}
      title="RC auto"
      subtitle="Il premio che paghi contro quello pagato da chi vive nella tua provincia (IVASS)."
      action={
        data.cars.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus /> Aggiungi un&apos;auto
          </Button>
        )
      }
    >
      {data.cars.length === 0 ? (
        <Card className="justify-items-start">
          <p className="text-sm">
            Scrivi quanto paghi di RC auto e ti dico se è tanto o poco per la tua provincia: il
            confronto è con i premi davvero pagati, rilevati dall&apos;IVASS su oltre due milioni di
            polizze.
          </p>
          <Button type="button" onClick={add}>
            <Plus /> Aggiungi la tua auto
          </Button>
        </Card>
      ) : (
        data.cars.map((car) => (
          <CarCard
            key={car.id}
            car={car}
            data={data}
            onEdit={() =>
              setEditing({
                id: car.id,
                label: car.label,
                premium: toInput(car.premium),
                renewsOn: car.renewsOn ?? "",
                bonusMalus: car.bonusMalus?.toString() ?? "",
                ageBand: car.ageBand ?? "",
              })
            }
            onDelete={() => setDeleting({ id: car.id, label: car.label })}
          />
        ))
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          {editing && (
            <CarForm key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Togliere «${deleting?.label ?? ""}»?`}
        description="Tolgo l'auto dal Tariffometro e non ti ricordo più la scadenza."
        successMessage="Auto tolta"
        onConfirm={() =>
          deleting ? deleteTariffCheck(deleting.id) : Promise.resolve({ ok: true })
        }
      />
    </Section>
  );
}

function CarCard({
  car,
  data,
  onEdit,
  onDelete,
}: {
  car: CarItem;
  data: Tariffometro;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const money = useMoney();
  const wholeMoney = useWholeMoney();
  const c = car.comparison;
  const days = car.renewsOn ? daysUntil(data.today, car.renewsOn) : null;
  const ended = days !== null && days < 0;
  const soon = days !== null && days >= 0 && days <= 30;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{car.label}</p>
          <p className="text-muted-foreground text-sm">
            {money(car.premium)} l&apos;anno
            {car.renewsOn && !ended && ` · scade ${onDate(car.renewsOn)}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            aria-label={`Modifica ${car.label}`}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label={`Togli ${car.label}`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {ended && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-(--warn-text)">
          La polizza è scaduta {onDate(car.renewsOn!)}: scrivi il premio e la scadenza di quella
          nuova, così il confronto resta giusto.
        </p>
      )}
      {soon && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-(--warn-text)">
          {days === 0 ? "Scade oggi" : days === 1 ? "Scade domani" : `Scade tra ${days} giorni`}: è
          il momento di chiedere i preventivi, prima di rinnovare.
        </p>
      )}

      {c ? (
        <>
          <VerdictBox verdict={c.verdict}>
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {c.verdict === "above"
                ? `Paghi ${money(c.over)} in più della media della provincia di ${c.provinceName}.`
                : c.verdict === "below"
                  ? `Paghi ${money(c.mean - car.premium)} meno della media della provincia di ${c.provinceName}.`
                  : `Sei in linea con la media della provincia di ${c.provinceName}.`}
              <VerdictBadge verdict={c.verdict} />
            </p>
            <p className="text-muted-foreground">
              {positionText(c.share, "automobilisti")} della provincia. La media è {money(c.mean)}{" "}
              l&apos;anno.
            </p>
          </VerdictBox>
          <DistributionBar
            value={car.premium}
            mean={c.mean}
            percentiles={c.percentiles}
            low={5}
            high={95}
            format={wholeMoney}
            label={`Il tuo premio di ${money(car.premium)} tra quelli della provincia di ${c.provinceName}: media ${money(c.mean)}.`}
          />
          {c.context.length > 0 && (
            <ul className="text-muted-foreground grid gap-1 text-sm">
              {c.context.map((note) => (
                <li key={note.reason}>
                  <ContextNote
                    note={note}
                    bonusMalus={car.bonusMalus}
                    above={c.verdict === "above"}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="bg-muted/40 rounded-xl p-3 text-sm">
          {!data.euro
            ? "I premi dell'IVASS sono in euro: il confronto vale per gli spazi in euro."
            : "Scegli la provincia in alto: il confronto è con chi abita lì."}
        </p>
      )}

      {car.saved > 0 && (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <PiggyBank className="size-4" aria-hidden />
          Rispetto alla polizza di prima risparmi {money(car.saved)} l&apos;anno.
        </p>
      )}

      <Moves open={c?.verdict === "above" || soon || ended} moves={carMoves(car)} />
    </Card>
  );
}

/** Why paying more than the province can be expected; the conclusion only when it's the case. */
function ContextNote({
  note,
  bonusMalus,
  above,
}: {
  note: CarContext;
  bonusMalus: number | null;
  above: boolean;
}) {
  const money = useMoney();
  return note.reason === "class" ? (
    <>
      Sei in classe {bonusMalus}: in Italia chi è {CLASS_GROUPS[note.group]} paga in media{" "}
      {money(note.average)}, contro {money(CAR_INSURANCE.byClass.first)} della classe 1, dove sta
      l&apos;87% delle polizze.
      {above && " Per questo la media della provincia ti sta stretta."}
    </>
  ) : (
    <>
      {AGE_GROUPS[note.group]} in Italia si pagano in media {money(note.average)}.
      {above &&
        " La media della provincia, fatta soprattutto di persone più grandi, ti sta stretta."}
    </>
  );
}

function carMoves(car: CarItem): Move[] {
  const moves: Move[] = [
    {
      text: "Chiedi i preventivi su Preventivass, il comparatore pubblico di IVASS e del Ministero: confronta il contratto base di tutte le compagnie, senza registrarti.",
      href: COMPARATORS.car.url,
      linkLabel: "Apri Preventivass",
    },
    {
      text: "Non serve disdire: la RC auto scade da sola e non si rinnova in automatico. La compagnia deve avvisarti 30 giorni prima, e la copertura vale ancora 15 giorni dopo la scadenza (art. 170-bis del Codice delle assicurazioni).",
    },
    {
      text: "Se un familiare che vive con te ha una classe di merito migliore, chiedi la «RC familiare»: puoi averla anche tu, pure tra auto e moto, se negli ultimi 5 anni non hai causato incidenti.",
    },
  ];
  if (!car.renewsOn) {
    moves.push({
      text: "Segna la scadenza della polizza: ti avviso io un mese prima, quando conviene chiedere i preventivi.",
    });
  }
  return moves;
}

function CarForm({ initial, onDone }: { initial: Editing; onDone: () => void }) {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const errors = result?.fieldErrors;
  const set = (key: keyof Editing) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await saveCarInsurance(form).catch(failed);
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success(form.id ? "Polizza aggiornata" : "Auto aggiunta: ecco il confronto");
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{form.id ? "Modifica la polizza" : "Aggiungi un'auto"}</DialogTitle>
        <DialogDescription>
          Ti servono il contratto o l&apos;ultima quietanza: lì trovi il premio della RC auto e la
          classe di merito.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Nome"
            name="label"
            placeholder="Es. Panda"
            maxLength={40}
            value={form.label}
            onChange={set("label")}
            errors={errors?.label}
          />
          <FormField
            label="Premio RC auto in un anno (€)"
            name="premium"
            inputMode="decimal"
            placeholder="0,00"
            value={form.premium}
            onChange={set("premium")}
            className="tabular-nums"
            errors={errors?.premium}
          />
        </div>
        <p className="text-muted-foreground -mt-2 text-xs">
          Solo la RC auto, tasse comprese: senza furto, incendio, assistenza stradale o altre
          garanzie, che l&apos;IVASS non conta.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Scadenza della polizza"
            name="renewsOn"
            type="date"
            value={form.renewsOn}
            onChange={set("renewsOn")}
            hint="Ti avviso io un mese prima."
            errors={errors?.renewsOn}
          />
          <SelectField
            label="Classe di merito"
            name="bonusMalus"
            value={form.bonusMalus}
            onChange={set("bonusMalus")}
            hint="La classe CU dell'attestato di rischio."
            errors={errors?.bonusMalus}
          >
            <NativeSelectOption value="">Non la so</NativeSelectOption>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
              <NativeSelectOption key={n} value={String(n)}>
                Classe {n}
              </NativeSelectOption>
            ))}
          </SelectField>
        </div>
        <SelectField
          label="Età di chi ha firmato il contratto"
          name="ageBand"
          value={form.ageBand}
          onChange={set("ageBand")}
          errors={errors?.ageBand}
        >
          <NativeSelectOption value="">Preferisco non dirlo</NativeSelectOption>
          {AGE_BANDS.map((b) => (
            <NativeSelectOption key={b} value={b}>
              {AGE_BAND_LABELS[b]}
            </NativeSelectOption>
          ))}
        </SelectField>
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
