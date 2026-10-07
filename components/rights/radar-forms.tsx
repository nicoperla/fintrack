"use client";

import { useState, type FormEvent } from "react";
import { BriefcaseBusiness, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useCurrencySymbol, useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { formatDayMonth } from "@/components/true-salary/format";
import { saveRentProfile, saveWelfare } from "@/app/(dashboard)/ritrovati/radar/actions";
import {
  INCOME_BANDS,
  INCOME_BAND_LABELS,
  RENT_CONTRACTS,
  RENT_CONTRACT_LABELS,
} from "@/lib/finance/rights";
import type { RightsRadar } from "@/lib/data/rights";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const failed = (): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." });
const toInput = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));

function Card({
  id,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  id: string;
  icon: typeof KeyRound;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="bg-card grid grid-cols-1 gap-4 rounded-2xl border p-5"
    >
      <div>
        <h2 id={`${id}-title`} className="flex items-center gap-2 font-medium">
          <Icon className="size-4" aria-hidden /> {title}
        </h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function RentCheck({ data }: { data: RightsRadar }) {
  const money = useMoney();
  const { profile, rent, year } = data;
  const [contract, setContract] = useState<string>(profile.rent.contract ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const errors = result?.fieldErrors;
  const deduction = rent.deduction;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    setPending(true);
    const res = await saveRentProfile({
      incomeBand: text("incomeBand"),
      birthYear: text("birthYear"),
      contract,
      since: text("since"),
      transferred: form.get("transferred") === "on",
    }).catch(failed);
    setPending(false);
    setResult(res.ok ? null : res);
    if (res.ok) toast.success("Risposte salvate: ho rifatto i conti");
  }

  return (
    <Card
      id="affitto"
      icon={KeyRound}
      title="La detrazione per l'affitto"
      subtitle="Nel precompilato di solito non c'è: se ti spetta, va aggiunta nel quadro E, rigo E71."
    >
      <p className="text-sm">
        {rent.months > 0
          ? `Nel ${year} ho visto ${rent.months === 1 ? "1 mese" : `${rent.months} mesi`} di affitto, per ${money(rent.paid)}.`
          : `Nel ${year} non vedo affitti tra i tuoi movimenti: se lo paghi, rispondi lo stesso.`}
      </p>

      {"code" in deduction ? (
        <div className="grid gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
          <p className="font-medium">
            Ti spettano circa{" "}
            <span className="text-emerald-700 tabular-nums dark:text-emerald-400">
              {money(deduction.amount)}
            </span>{" "}
            per il {year}.
          </p>
          <p className="text-muted-foreground">
            {deduction.label}
            {deduction.months < 12 &&
              `, per ${deduction.months === 1 ? "1 mese" : `${deduction.months} mesi`}`}
            . Nel 730: quadro E, rigo E71, tipo {deduction.code}. Se le tasse non bastano, la parte
            che resta ti viene rimborsata lo stesso; con un contratto cointestato si divide tra gli
            intestatari.
          </p>
        </div>
      ) : (
        <p className="bg-muted/40 rounded-xl p-3 text-sm">{deduction.reason}</p>
      )}

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Il contratto della casa dove vivi"
            name="contract"
            value={contract}
            onChange={(e) => setContract(e.target.value)}
            errors={errors?.contract}
          >
            <NativeSelectOption value="">Non pago l&apos;affitto</NativeSelectOption>
            {RENT_CONTRACTS.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {RENT_CONTRACT_LABELS[c]}
              </NativeSelectOption>
            ))}
          </SelectField>
          <SelectField
            label={`Reddito complessivo del ${year}`}
            name="incomeBand"
            defaultValue={profile.incomeBand ?? ""}
            hint="Quello lordo della Certificazione Unica, non lo stipendio netto."
            errors={errors?.incomeBand}
          >
            <NativeSelectOption value="">Scegli la fascia</NativeSelectOption>
            {INCOME_BANDS.map((b) => (
              <NativeSelectOption key={b} value={b}>
                {INCOME_BAND_LABELS[b]}
              </NativeSelectOption>
            ))}
          </SelectField>
          <FormField
            label="Anno di nascita"
            name="birthYear"
            inputMode="numeric"
            placeholder="Es. 1998"
            defaultValue={profile.birthYear ?? ""}
            hint="Tra i 20 e i 31 anni c'è una detrazione più alta, per i giovani."
            errors={errors?.birthYear}
          />
          {contract && (
            <FormField
              label="Anno di inizio del contratto"
              name="since"
              inputMode="numeric"
              placeholder="Es. 2024"
              defaultValue={profile.rent.since ?? ""}
              hint="Quella per i giovani vale nei primi quattro anni."
              errors={errors?.since}
            />
          )}
        </div>
        {contract && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="transferred"
              defaultChecked={profile.rent.transferred}
              className="accent-primary mt-0.5 size-4"
            />
            <span>
              Mi sono trasferito per lavoro negli ultimi tre anni, a più di 100 km o in
              un&apos;altra regione
            </span>
          </label>
        )}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvataggio…" : "Calcola"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function WelfareCheck({ data }: { data: RightsRadar }) {
  const money = useMoney();
  const symbol = useCurrencySymbol();
  const { welfare, fringe, profile, currentYear, children } = data;
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const errors = result?.fieldErrors;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    setPending(true);
    const res = await saveWelfare({
      balance: text("balance"),
      expiresOn: text("expiresOn"),
      fringe: text("fringe"),
    }).catch(failed);
    setPending(false);
    setResult(res.ok ? null : res);
    if (res.ok) toast.success("Welfare salvato: ti avviso io prima che scada");
  }

  const used = fringe.used ?? 0;
  return (
    <Card
      id="welfare"
      icon={BriefcaseBusiness}
      title="Il welfare aziendale"
      subtitle="Il credito da usare prima che scada, e i fringe benefit da tenere sotto la soglia."
    >
      {welfare && (
        <p
          className={cn(
            "rounded-xl border p-3 text-sm",
            welfare.state === "ok"
              ? "border-border bg-muted/30"
              : "border-amber-500/40 bg-amber-500/10 text-(--warn-text)",
          )}
        >
          {welfare.state === "expired"
            ? `Il credito welfare è scaduto il ${formatDayMonth(welfare.expiresOn)}: se c'era ancora qualcosa, chiedi all'azienda; poi aggiorna il saldo.`
            : welfare.state === "soon"
              ? `Il credito welfare di ${money(welfare.balance)} scade ${welfare.days === 0 ? "oggi" : welfare.days === 1 ? "domani" : `tra ${welfare.days} giorni`}: usalo prima che vada perso.`
              : `Credito welfare: ${money(welfare.balance)} da usare entro il ${formatDayMonth(welfare.expiresOn)}. Ti avviso io un mese prima.`}
        </p>
      )}

      <div className="grid gap-2 text-sm">
        <p>
          Nel {currentYear} i fringe benefit sono esenti fino a {money(fringe.limit)}
          {children > 0 ? ", perché hai figli a carico" : ""}: superata la soglia anche di 1 €,
          diventano tassati tutti, non solo la parte in più.
        </p>
        {fringe.used !== null && (
          <>
            <div
              className="bg-muted h-2 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={fringe.limit}
              aria-valuenow={Math.min(used, fringe.limit)}
              aria-label="Fringe benefit ricevuti sulla soglia"
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  fringe.state === "over"
                    ? "bg-(--delta-bad)"
                    : fringe.state === "near"
                      ? "bg-amber-500"
                      : "bg-emerald-500",
                )}
                style={{ width: `${Math.min(100, (used / fringe.limit) * 100)}%` }}
              />
            </div>
            <p className={cn(fringe.state !== "ok" && "font-medium text-(--warn-text)")}>
              {fringe.state === "over"
                ? `Hai ricevuto ${money(used)}: oltre la soglia. Parlane con l'ufficio del personale, perché in busta paga diventano tutti tassati.`
                : fringe.state === "near"
                  ? `Hai ricevuto ${money(used)}: mancano ${money(fringe.left)} alla soglia.`
                  : `Hai ricevuto ${money(used)}: puoi riceverne ancora ${money(fringe.left)} senza tasse.`}
            </p>
          </>
        )}
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField
            label={`Credito welfare da usare (${symbol})`}
            name="balance"
            inputMode="decimal"
            placeholder="Nessuno"
            defaultValue={toInput(profile.welfare.balance)}
            errors={errors?.balance}
          />
          <FormField
            label="Da usare entro"
            name="expiresOn"
            type="date"
            defaultValue={profile.welfare.expiresOn ?? ""}
            errors={errors?.expiresOn}
          />
          <FormField
            label={`Fringe benefit del ${currentYear} (${symbol})`}
            name="fringe"
            inputMode="decimal"
            placeholder="Nessuno"
            defaultValue={toInput(fringe.used)}
            hint="Buoni spesa e carburante, bollette o affitto pagati dall'azienda."
            errors={errors?.fringe}
          />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvataggio…" : "Salva"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
