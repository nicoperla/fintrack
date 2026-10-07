"use client";

import { useState } from "react";
import { Download, FileSearch, ShieldCheck } from "lucide-react";
import { useMoney } from "@/components/currency-provider";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RentCheck, WelfareCheck } from "@/components/rights/radar-forms";
import {
  DEDUCTION_TYPES,
  RULES,
  RULES_CHECKED_AT,
  type DeductionType,
} from "@/lib/finance/deductions";
import { parseAmount } from "@/lib/finance/money";
import { compareWithPrecompiled } from "@/lib/finance/rights";
import type { RightsRadar } from "@/lib/data/rights";
import { cn } from "@/lib/utils";

export function RadarView({ data }: { data: RightsRadar }) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PrecompiledCheck data={data} />
      <RentCheck data={data} />
      <WelfareCheck data={data} />
      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          FinTrack ti informa, non fa assistenza fiscale: il 730 lo modifichi tu sul sito
          dell&apos;Agenzia delle Entrate, oppure con un CAF o un professionista. Le cifre sono
          stime; regole verificate a {RULES_CHECKED_AT}.
        </span>
      </p>
    </div>
  );
}

/**
 * The totals typed by the user stay in the browser: the precompilato has health data in it, so
 * nothing of it is sent or saved.
 */
function PrecompiledCheck({ data }: { data: RightsRadar }) {
  const money = useMoney();
  const [typed, setTyped] = useState<Partial<Record<DeductionType, string>>>({});
  const [rentIncluded, setRentIncluded] = useState(false);

  // Only the lines the user filled in are compared: an empty field isn't a zero.
  const compared = DEDUCTION_TYPES.filter((t) => (typed[t] ?? "").trim() !== "");
  const precompiled = Object.fromEntries(
    compared.map((t) => [t, Number(parseAmount(typed[t]!) ?? 0)]),
  ) as Partial<Record<DeductionType, number>>;
  const rent =
    "amount" in data.rent.deduction && data.rent.deduction.amount > 0
      ? { amount: data.rent.deduction.amount, inPrecompiled: rentIncluded }
      : null;
  const result = compareWithPrecompiled({
    fintrack: Object.fromEntries(compared.map((t) => [t, data.fintrack[t] ?? 0])),
    precompiled,
    children: data.children,
    rent,
  });
  const missingRows = result.rows.filter((r) => compared.includes(r.type) && r.missing > 0);
  const seen = DEDUCTION_TYPES.filter((t) => (data.fintrack[t] ?? 0) > 0);
  // Types FinTrack saw first: those are the ones worth checking.
  const order = [...seen, ...DEDUCTION_TYPES.filter((t) => !seen.includes(t))];

  return (
    <section
      aria-labelledby="precompilato-title"
      className="bg-card grid grid-cols-1 gap-4 rounded-2xl border p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="precompilato-title" className="flex items-center gap-2 font-medium">
            <FileSearch className="size-4" aria-hidden /> Confronta col precompilato
          </h2>
          <p className="text-muted-foreground text-sm">
            Le spese del {data.year} che ho visto passare, contro quelle del tuo 730/
            {data.year + 1} precompilato.
          </p>
        </div>
        {data.pro && seen.length > 0 && (
          <a
            href={`/api/ritrovati/dossier?anno=${data.year}&chi=io`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download /> Le mie spese (PDF)
          </a>
        )}
      </div>

      <p className="bg-muted/40 rounded-xl p-3 text-sm">
        Apri il precompilato sul sito dell&apos;Agenzia delle Entrate e scrivi qui i totali del
        quadro E: le spese sanitarie sono al rigo E1, le altre nei righi da E8 a E10. Quello che
        scrivi resta in questa pagina: non lo salvo.
      </p>

      <ul className="divide-y text-sm">
        {order.map((type) => {
          const own = data.fintrack[type] ?? 0;
          const row = result.rows.find((r) => r.type === type)!;
          const filled = compared.includes(type);
          return (
            <li key={type} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{RULES[type].label}</p>
                <p className="text-muted-foreground text-xs">
                  {own > 0 ? `Ne ho viste ${money(own)}` : "Non ne ho viste tra i tuoi movimenti"}
                  {filled && row.missing > 0 && (
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {" "}
                      · mancano almeno {money(row.missing)}: +{money(row.extraRefund)}
                    </span>
                  )}
                  {filled && row.missing === 0 && own > 0 && " · nel precompilato ci sono già"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground hidden sm:inline">Nel precompilato</span>
                <Input
                  inputMode="decimal"
                  placeholder="Totale"
                  value={typed[type] ?? ""}
                  onChange={(e) => setTyped((t) => ({ ...t, [type]: e.target.value }))}
                  className="h-8 w-28 text-right tabular-nums"
                  aria-label={`${RULES[type].label}: totale nel precompilato`}
                />
              </label>
            </li>
          );
        })}
        {rent && (
          <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">Detrazione per l&apos;affitto</p>
              <p className="text-muted-foreground text-xs">
                Ti spettano circa {money(rent.amount)} (rigo E71)
                {!rentIncluded && (
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {" "}
                    · se manca: +{money(rent.amount)}
                  </span>
                )}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={rentIncluded}
                onChange={(e) => setRentIncluded(e.target.checked)}
                className="accent-primary size-4"
              />
              <span>C&apos;è già</span>
            </label>
          </li>
        )}
      </ul>

      <div
        aria-live="polite"
        className={cn(
          "rounded-xl border p-4 text-sm",
          result.extraRefund > 0
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-border bg-muted/30",
        )}
      >
        {result.extraRefund > 0 ? (
          <>
            <p className="font-medium">
              Puoi chiedere circa{" "}
              <span className="text-emerald-700 tabular-nums dark:text-emerald-400">
                {money(result.extraRefund)}
              </span>{" "}
              di rimborso in più.
            </p>
            <p className="text-muted-foreground mt-1">
              {[
                missingRows.length > 0 &&
                  `Mancano spese per almeno ${money(result.missingTotal)}: aggiungile nel quadro E prima di inviare il 730, con i documenti a portata di mano.`,
                result.rentExtra > 0 &&
                  "La detrazione per l'affitto va aggiunta nel rigo E71; se le tasse non bastano, la parte che resta ti viene rimborsata comunque.",
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
          </>
        ) : compared.length > 0 ? (
          <p>Per quello che ho visto io, nel precompilato c&apos;è già tutto.</p>
        ) : (
          <p className="text-muted-foreground">
            Scrivi almeno un totale del precompilato: ti dico subito cosa manca.
          </p>
        )}
      </div>
    </section>
  );
}
