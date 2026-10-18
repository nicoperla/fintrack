"use client";

import { useRef, useState } from "react";
import { ExternalLink, FileSearch, FileUp, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProLock, TaxSection, TONE_BOX, useAction } from "@/components/tax/ui";
import { pdfLines } from "@/components/tax/read-pdf";
import { setDecision } from "@/app/(dashboard)/730/actions";
import { DEDUCTION_TYPES, RULES, type DeductionType } from "@/lib/finance/deductions";
import { parseAmount } from "@/lib/finance/money";
import { compareWithPrecompiled } from "@/lib/finance/rights";
import { longDay } from "@/lib/tax/calendar";
import { parsePrecompiled } from "@/lib/tax/precompiled";
import type { Decision } from "@/lib/tax/next-step";
import type { My730 } from "@/lib/data/my730";
import { cn } from "@/lib/utils";

const where = (type: DeductionType) => {
  const w = RULES[type].where;
  return w.code ? `rigo ${w.line}, codice ${w.code}` : `rigo ${w.line}`;
};

const toInput = (n: number) => n.toFixed(2).replace(".", ",");

const CHOICES: { value: Decision; title: string; text: string }[] = [
  {
    value: "ACCEPT",
    title: "Lo accetto così com'è",
    text: "Se lo invii senza modifiche, sulle spese comunicate da farmacie, banche, scuole e assicurazioni l'Agenzia non ti chiederà i documenti.",
  },
  {
    value: "MODIFY",
    title: "Lo modifico",
    text: "Aggiungi quello che manca, ti dico io dove. Delle spese che aggiungi conserva le ricevute: possono essere controllate.",
  },
  {
    value: "CAF",
    title: "Vado al CAF",
    text: "Porti la lista dei documenti. Il CAF controlla tutto e mette il visto: se sbaglia per colpa sua, la sanzione la paga lui.",
  },
];

/**
 * The precompilato, opened together: the totals of quadro E (read from the PDF in the browser,
 * or typed), against the expenses Orbitly saw; what's missing, where to write it, and the choice.
 * Nothing typed or read here is sent or saved.
 */
export function PrecompiledCard({ data }: { data: My730 }) {
  const money = useMoney();
  const fileRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState<Partial<Record<DeductionType, string>>>({});
  const [rentIncluded, setRentIncluded] = useState(false);
  const [reading, setReading] = useState(false);
  const [readCount, setReadCount] = useState<number | null>(null);
  const { pending, run } = useAction();
  const c = data.rules.calendar;
  const open = data.today >= c.precompiled;

  const fintrackOf = (t: DeductionType) =>
    data.summary.byType.find((b) => b.type === t)?.eligible ?? 0;
  const compared = DEDUCTION_TYPES.filter((t) => (typed[t] ?? "").trim() !== "");
  const precompiled = Object.fromEntries(
    compared.map((t) => [t, Number(parseAmount(typed[t]!) ?? 0)]),
  ) as Partial<Record<DeductionType, number>>;
  const rentAmount = "code" in data.rent.deduction ? data.rent.deduction.amount : 0;
  const result = compareWithPrecompiled({
    fintrack: Object.fromEntries(compared.map((t) => [t, fintrackOf(t)])),
    precompiled,
    children: data.children,
    rent: rentAmount > 0 ? { amount: rentAmount, inPrecompiled: rentIncluded } : null,
    marginalRate: data.marginal,
  });
  const missing = result.rows.filter((r) => compared.includes(r.type) && r.missing > 0);
  const seen = DEDUCTION_TYPES.filter((t) => fintrackOf(t) > 0);
  const order = [...seen, ...DEDUCTION_TYPES.filter((t) => !seen.includes(t))];

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      toast.error("Serve il PDF del precompilato.");
      return;
    }
    setReading(true);
    try {
      const reading = parsePrecompiled(await pdfLines(file));
      const entries = Object.entries(reading.totals) as [DeductionType, number][];
      if (!entries.length && !reading.rent) {
        toast.error("Non ho trovato i righi del quadro E: scrivi i totali a mano qui sotto.");
        setReadCount(0);
      } else {
        // Every type is filled: what isn't in the PDF is a zero in the precompilato.
        setTyped(
          Object.fromEntries(
            DEDUCTION_TYPES.map((t) => [t, toInput(reading.totals[t] ?? 0)]),
          ) as Partial<Record<DeductionType, string>>,
        );
        setRentIncluded(reading.rent);
        setReadCount(reading.found.length + (reading.rent ? 1 : 0));
        toast.success("Letto: controlla i numeri qui sotto");
      }
    } catch (error) {
      console.error("[precompilato]", error);
      toast.error("Non riesco a leggere questo PDF: scrivi i totali a mano qui sotto.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <TaxSection
      id="precompilato"
      icon={FileSearch}
      title="Il precompilato, insieme"
      subtitle={
        open
          ? `Il ${data.rules.model} precompilato è uscito: confrontiamolo con quello che ho visto io.`
          : `Esce il ${longDay(c.precompiled)} ${c.precompiled.slice(0, 4)}: intanto puoi vedere come funziona.`
      }
    >
      <ol className="grid gap-2 text-sm sm:grid-cols-3">
        {[
          {
            n: 1,
            text: "Entra nel sito dell'Agenzia con SPID, CIE o CNS. Orbitly non vede mai le tue credenziali.",
          },
          { n: 2, text: "Apri il 730 precompilato e scarica il PDF del modello." },
          { n: 3, text: "Caricalo qui: lo leggo nel tuo browser, non lo invio e non lo salvo." },
        ].map((s) => (
          <li key={s.n} className="flex gap-2 rounded-xl border p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-xs font-semibold text-violet-700 dark:text-violet-300">
              {s.n}
            </span>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href="https://infoprecompilata.agenziaentrate.gov.it/portale/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-2 hover:underline"
        >
          Vai al sito del precompilato <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>

      {data.pro ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            id="precompilato-file"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={reading}
            onClick={() => fileRef.current?.click()}
          >
            {reading ? <Loader2 className="animate-spin" /> : <FileUp />}
            {reading ? "Leggo…" : "Carica il PDF del precompilato"}
          </Button>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3.5" aria-hidden /> Resta sul tuo dispositivo. Lettura in
            prova: controlla sempre i numeri.
          </p>
          {readCount !== null && readCount > 0 && (
            <p className="w-full text-xs text-emerald-700 dark:text-emerald-400">
              Ho letto {readCount} {readCount === 1 ? "rigo" : "righi"} del quadro E.
            </p>
          )}
        </div>
      ) : (
        <ProLock what="carichi il PDF del precompilato e lo leggo io, senza ricopiare niente" />
      )}

      <ul className="divide-y text-sm">
        {order.map((type) => {
          const own = fintrackOf(type);
          const row = result.rows.find((r) => r.type === type)!;
          const filled = compared.includes(type);
          return (
            <li key={type} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{RULES[type].label}</p>
                <p className="text-muted-foreground text-xs">
                  {where(type)} · {own > 0 ? `ne ho viste ${money(own)}` : "non ne ho viste"}
                  {filled && row.missing > 0 && (
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {" "}
                      · mancano almeno {money(row.missing)}: +{money(row.extraRefund)}
                    </span>
                  )}
                  {filled && row.missing === 0 && own > 0 && " · ci sono già"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground hidden sm:inline">Nel precompilato</span>
                <Input
                  inputMode="decimal"
                  placeholder="Totale"
                  className="w-28"
                  value={typed[type] ?? ""}
                  onChange={(e) => setTyped((t) => ({ ...t, [type]: e.target.value }))}
                  aria-label={`${RULES[type].label}: totale nel precompilato`}
                />
              </label>
            </li>
          );
        })}
        {rentAmount > 0 && "code" in data.rent.deduction && (
          <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">Detrazione per l&apos;affitto</p>
              <p className="text-muted-foreground text-xs">
                rigo E71, tipo {data.rent.deduction.code} · ti spettano circa {money(rentAmount)}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={rentIncluded}
                onChange={(e) => setRentIncluded(e.target.checked)}
              />
              C&apos;è già
            </label>
          </li>
        )}
      </ul>

      <div
        aria-live="polite"
        className={cn(
          "rounded-xl border p-4 text-sm",
          result.extraRefund > 0 ? TONE_BOX.good : "border-border bg-muted/30",
        )}
      >
        {result.extraRefund > 0 ? (
          <div className="grid gap-2">
            <p className="font-medium">
              Puoi chiedere circa{" "}
              <span className="text-emerald-700 tabular-nums dark:text-emerald-400">
                {money(result.extraRefund)}
              </span>{" "}
              di rimborso in più. Ecco cosa scrivere:
            </p>
            <ul className="grid gap-1">
              {missing.map((r) => (
                <li key={r.type}>
                  Quadro E, {where(r.type)}: scrivi{" "}
                  <strong>{money(Math.max(r.fintrack, r.precompiled))}</strong> invece di{" "}
                  {money(r.precompiled)} ({RULES[r.type].label.toLowerCase()}).
                </li>
              ))}
              {result.rentExtra > 0 && "code" in data.rent.deduction && (
                <li>
                  Quadro E, rigo E71: tipo {data.rent.deduction.code}, con i giorni e la percentuale
                  del contratto. Se le tasse non bastano, ti viene rimborsata lo stesso.
                </li>
              )}
            </ul>
          </div>
        ) : compared.length > 0 ? (
          <p>Per quello che ho visto io, nel precompilato c&apos;è già tutto.</p>
        ) : (
          <p className="text-muted-foreground">
            Carica il PDF o scrivi almeno un totale: ti dico subito cosa manca.
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">E adesso, cosa fai?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHOICES.map((choice) => {
            const active = data.decision === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                disabled={pending}
                aria-pressed={active}
                onClick={() =>
                  run(
                    () => setDecision(data.year, active ? null : choice.value),
                    active ? undefined : "Scelta salvata",
                  )
                }
                className={cn(
                  "grid gap-1 rounded-xl border p-3 text-left text-sm transition-colors",
                  active ? "border-violet-500/60 bg-violet-500/5" : "hover:bg-muted/50",
                )}
              >
                <span className="font-medium">{choice.title}</span>
                <span className="text-muted-foreground text-xs">{choice.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </TaxSection>
  );
}
