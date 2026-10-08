"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { BellRing, MapPin, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { useMoney, useSharedSpace } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormMessage, SelectField } from "@/components/forms/form-field";
import { onDate } from "@/components/true-salary/format";
import { BankSection } from "@/components/tariffs/bank-section";
import { CarSection } from "@/components/tariffs/car-section";
import { ElectricitySection } from "@/components/tariffs/electricity-section";
import { Card, fromDate } from "@/components/tariffs/tariff-ui";
import { saveTariffProfile, setTariffPool } from "@/app/(dashboard)/ritrovati/tariffometro/actions";
import {
  BANK_ACCOUNTS,
  CAR_INSURANCE,
  ELECTRICITY,
  TARIFF_DATA_CHECKED_AT,
} from "@/lib/finance/tariff-data";
import { PROVINCE_OPTIONS, type TariffKind } from "@/lib/finance/tariffs";
import type { Tariffometro } from "@/lib/data/tariffs";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const failed = (): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." });

const KIND_NAMES: Record<TariffKind, string> = {
  CAR_INSURANCE: "RC auto",
  BANK_ACCOUNT: "Conto",
  ELECTRICITY: "Luce",
};

/** "RC auto · Panda", but "Luce di casa" rather than "Luce · Luce di casa". */
const chipLabel = (kind: TariffKind, label: string) =>
  label.toLowerCase().includes(KIND_NAMES[kind].toLowerCase())
    ? label
    : `${KIND_NAMES[kind]} · ${label}`;

export function TariffView({ data }: { data: Tariffometro }) {
  return (
    <div className="grid grid-cols-1 gap-8">
      <div className="grid grid-cols-1 gap-4">
        <Summary data={data} />
        <ProfileCard data={data} />
      </div>
      <CarSection data={data} />
      <BankSection data={data} />
      <ElectricitySection data={data} />
      <PoolCard data={data} />
      <Sources />
    </div>
  );
}

function Summary({ data }: { data: Tariffometro }) {
  const money = useMoney();
  const { summary, renewals } = data;
  if (summary.compared === 0 && renewals.length === 0) return null;
  const n = summary.above.length;
  return (
    <div
      className={cn(
        "grid gap-3 rounded-2xl border p-5",
        n > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5",
      )}
    >
      {summary.compared > 0 && (
        <div>
          <p className="text-lg font-semibold">
            {n > 0
              ? `${n === 1 ? "Su una voce" : `Su ${n} voci`} paghi più degli altri: circa ${money(summary.overPerYear)} l'anno in più.`
              : summary.compared === 1
                ? "Sulla voce che hai confrontato non paghi più degli altri."
                : `Sulle ${summary.compared} voci che hai confrontato non paghi più degli altri.`}
          </p>
          <p className="text-muted-foreground text-sm">
            {n > 0
              ? "Sotto ogni voce trovi come pagare meno, con i comparatori pubblici."
              : "Bene così: ti avviso io quando si avvicina una scadenza."}
          </p>
        </div>
      )}
      {n > 0 && (
        <ul className="flex flex-wrap gap-2">
          {summary.above.map((a, i) => (
            <li
              key={i}
              className="bg-background rounded-full border px-3 py-1 text-xs font-medium tabular-nums"
            >
              {chipLabel(a.kind, a.label)} +{money(a.over)}
            </li>
          ))}
        </ul>
      )}
      {renewals.map((r) => (
        <p key={r.id} className="flex items-start gap-2 text-sm text-(--warn-text)">
          <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
          {r.kind === "CAR_INSURANCE"
            ? `La RC auto di «${r.label}» scade ${onDate(r.date)}: è il momento di chiedere i preventivi.`
            : `Il prezzo bloccato di «${r.label}» scade ${onDate(r.date)}: confronta le offerte prima.`}
        </p>
      ))}
    </div>
  );
}

function ProfileCard({ data }: { data: Tariffometro }) {
  const { province, householdSize } = data.profile;
  const [editing, setEditing] = useState(province === null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const errors = result?.fieldErrors;
  const provinceName = PROVINCE_OPTIONS.find((p) => p.code === province)?.name;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const res = await saveTariffProfile({
      province: String(form.get("province") ?? ""),
      householdSize: String(form.get("householdSize") ?? ""),
    }).catch(failed);
    setPending(false);
    setResult(res.ok ? null : res);
    if (res.ok) {
      toast.success("Fatto: confronto con la tua provincia");
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5">
          <MapPin className="text-muted-foreground size-4" aria-hidden />
          Provincia di {provinceName}
        </span>
        {householdSize !== null && (
          <span className="flex items-center gap-1.5">
            <Users className="text-muted-foreground size-4" aria-hidden />
            {householdSize === 1 ? "1 persona in casa" : `${householdSize} persone in casa`}
          </span>
        )}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          onClick={() => setEditing(true)}
        >
          Cambia
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <div>
        <h2 className="flex items-center gap-2 font-medium">
          <MapPin className="size-4" aria-hidden /> Dove vivi
        </h2>
        <p className="text-muted-foreground text-sm">
          La provincia serve per l&apos;RC auto: tra Napoli e Aosta ci sono 255 € di differenza
          media. Quante persone siete serve per il confronto con famiglie simili.
        </p>
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Provincia"
            name="province"
            defaultValue={province ?? ""}
            errors={errors?.province}
          >
            <NativeSelectOption value="">Scegli la provincia</NativeSelectOption>
            {PROVINCE_OPTIONS.map((p) => (
              <NativeSelectOption key={p.code} value={p.code}>
                {p.name}
              </NativeSelectOption>
            ))}
          </SelectField>
          <SelectField
            label="Persone in casa"
            name="householdSize"
            defaultValue={householdSize?.toString() ?? ""}
            errors={errors?.householdSize}
          >
            <NativeSelectOption value="">Preferisco non dirlo</NativeSelectOption>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <NativeSelectOption key={n} value={String(n)}>
                {n === 1 ? "1 persona" : n === 6 ? "6 o più" : `${n} persone`}
              </NativeSelectOption>
            ))}
          </SelectField>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvataggio…" : "Salva"}
          </Button>
          {province !== null && (
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Annulla
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

/**
 * The comparison between users needs many of them: until then, those who want to take part say
 * so, and their figures are ready when there are enough.
 */
function PoolCard({ data }: { data: Tariffometro }) {
  const shared = useSharedSpace();
  const [pending, start] = useTransition();
  const since = data.profile.poolSince;

  const toggle = (join: boolean) =>
    start(async () => {
      const res = await setTariffPool(join).catch(failed);
      if (res.ok) toast.success(join ? "Grazie: partecipi al confronto" : "Non partecipi più");
      else toast.error(res.error ?? "Salvataggio non riuscito. Riprova.");
    });

  return (
    <Card>
      <div>
        <h2 className="flex items-center gap-2 font-medium">
          <Users className="size-4" aria-hidden /> Il confronto con chi vive come te
        </h2>
        <p className="text-muted-foreground text-sm">
          Le medie pubbliche sono un inizio. Il passo dopo è sapere quanto pagano le famiglie
          FinTrack della tua provincia per internet, luce e assicurazioni: funzionerà quando saremo
          abbastanza, e solo con chi sceglie di partecipare.
        </p>
      </div>
      <ul className="grid list-disc gap-1 pl-5 text-sm">
        <li>
          Se partecipi, i premi, i costi e le bollette che scrivi qui, con la provincia e il numero
          di persone in casa, entreranno in medie anonime.
        </li>
        <li>
          Mostreremo un dato solo se viene da almeno 20 famiglie, con un piccolo scarto casuale: mai
          i singoli importi, mai i nomi.
        </li>
        <li>
          Oggi non li condividiamo con nessuno: li teniamo pronti per quando partirà. I dettagli
          sono nell&apos;
          <Link href="/privacy#confronto" className="underline underline-offset-2">
            informativa privacy
          </Link>
          .
        </li>
      </ul>
      {since ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-4" aria-hidden />
            Partecipi {fromDate(since)} {since.slice(0, 4)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => toggle(false)}
          >
            Non partecipo più
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={pending} onClick={() => toggle(true)}>
            Partecipo
          </Button>
          <p className="text-muted-foreground text-xs">
            Puoi cambiare idea quando vuoi.
            {shared && " La scelta vale per tutto lo spazio: chi ne fa parte può cambiarla."}
          </p>
        </div>
      )}
    </Card>
  );
}

function Sources() {
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-xs">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        Fonti pubbliche:{" "}
        <a href={CAR_INSURANCE.url} target="_blank" rel="noreferrer" className="underline">
          IVASS
        </a>{" "}
        (premi RC auto del {CAR_INSURANCE.period}),{" "}
        <a href={BANK_ACCOUNTS.url} target="_blank" rel="noreferrer" className="underline">
          Banca d&apos;Italia
        </a>{" "}
        (costo dei conti correnti nel {BANK_ACCOUNTS.year}),{" "}
        <a href={ELECTRICITY.url} target="_blank" rel="noreferrer" className="underline">
          ARERA
        </a>{" "}
        (prezzo di riferimento della luce per i clienti vulnerabili). Sono medie, non preventivi.
        FinTrack non vende polizze né contratti e non prende commissioni: i link portano solo ai
        comparatori pubblici. Dati verificati a {TARIFF_DATA_CHECKED_AT}.
      </span>
    </p>
  );
}
