"use client";

import { useState } from "react";
import { AlertTriangle, Check, FolderOpen, HelpCircle } from "lucide-react";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { DEDUCTION_ICONS } from "@/components/found-money/found-money-view";
import { ProLock, TaxSection, useAction } from "@/components/tax/ui";
import { setExpenseDoc } from "@/app/(dashboard)/730/actions";
import { setDeduction } from "@/app/(dashboard)/ritrovati/actions";
import { RULES, type DeductionLine, type TypeSummary } from "@/lib/finance/deductions";
import { cn } from "@/lib/utils";

type Line = DeductionLine & { hasDoc: boolean };

const shortDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fmtDate = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

const whereText = (type: TypeSummary["type"]) => {
  const w = RULES[type].where;
  return w.code ? `rigo ${w.line}, codice ${w.code}` : `rigo ${w.line}`;
};

/**
 * La cartellina: the year's deductible expenses grouped by kind, with where they go in the 730,
 * what to keep, and a tick for each receipt already put aside.
 */
export function FolderCard({
  year,
  byType,
  lines,
  refund,
  marginal,
}: {
  year: number;
  byType: TypeSummary[];
  lines: Line[] | null;
  refund: number;
  marginal: number;
}) {
  const money = useMoney();
  const [open, setOpen] = useState<string | null>(byType[0]?.type ?? null);

  return (
    <TaxSection
      id="cartellina"
      icon={FolderOpen}
      title="La cartellina"
      subtitle={`Le spese del ${year} che abbassano le tasse, con il documento da tenere e il rigo del 730.`}
      aside={
        <div className="text-right">
          <p className="text-muted-foreground text-xs">Ti tornano circa</p>
          <p className="text-2xl font-semibold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
            {money(refund)}
          </p>
        </div>
      }
    >
      {byType.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Ancora nessuna spesa detraibile nel {year}. Farmacia, visite, veterinario, scuola,
          università, sport dei figli, mezzi pubblici, donazioni, fondo pensione: registrali e li
          metto io nella cartellina.
        </p>
      ) : (
        <ul className="grid gap-2">
          {byType.map((t) => {
            const Icon = DEDUCTION_ICONS[t.type];
            const rule = RULES[t.type];
            const own = lines?.filter((l) => l.type === t.type) ?? [];
            const docs = own.filter((l) => l.status === "ok");
            const withDoc = docs.filter((l) => l.hasDoc).length;
            const expanded = open === t.type;
            return (
              <li key={t.type} className="rounded-xl border">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : t.type)}
                  aria-expanded={expanded}
                  className="hover:bg-muted/40 flex w-full items-center gap-3 rounded-xl p-3 text-left"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{rule.label}</span>
                    <span className="text-muted-foreground block text-xs">
                      {money(t.eligible)} di spese · {whereText(t.type)}
                      {lines && docs.length > 0 && ` · ricevute ${withDoc} di ${docs.length}`}
                    </span>
                  </span>
                  <span className="text-right text-sm font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
                    +{money(t.refund)}
                  </span>
                </button>
                {expanded && (
                  <div className="grid gap-3 border-t p-3 text-sm">
                    <p className="text-muted-foreground text-xs">
                      {rule.kind === "deduzione"
                        ? `Deduzione: si toglie dal reddito e rende quanto la tua aliquota (${Math.round(marginal * 100)}%)`
                        : `Detrazione del ${Math.round(rule.rate * 100)}%`}
                      {rule.franchigia ? `, oltre i primi ${money(rule.franchigia)}` : ""}
                      {t.cap !== null ? `, fino a ${money(t.cap)}` : ""}. Da tenere:{" "}
                      {t.type === "sanitarie"
                        ? "se hai dato il codice fiscale la spesa arriva da sola nel precompilato; tieni la ricevuta per quelle che mancano."
                        : rule.documents}
                    </p>
                    {rule.note && <p className="text-muted-foreground text-xs">{rule.note}</p>}
                    {t.belowFranchigia && (
                      <p className="text-xs text-sky-700 dark:text-sky-400">
                        Sei ancora sotto la franchigia: per ora queste spese non rendono.
                      </p>
                    )}
                    {lines ? (
                      <ul className="divide-y">
                        {own.map((l) => (
                          <ExpenseRow key={l.id} line={l} />
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!lines && byType.length > 0 && (
        <ProLock what="vedi le spese una per una, confermi quelle incerte e segni le ricevute che hai" />
      )}
    </TaxSection>
  );
}

function ExpenseRow({ line }: { line: Line }) {
  const money = useMoney();
  const { pending, run } = useAction();
  const [hasDoc, setHasDoc] = useState(line.hasDoc);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
      {line.status === "ok" ? (
        <button
          type="button"
          aria-pressed={hasDoc}
          aria-label={`Ricevuta di ${line.description}: ${hasDoc ? "ce l'ho" : "da tenere da parte"}`}
          onClick={() => {
            setHasDoc(!hasDoc);
            run(() => setExpenseDoc(line.id, !hasDoc));
          }}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
            hasDoc ? "border-emerald-500 bg-emerald-500 text-white" : "hover:border-foreground/40",
          )}
        >
          {hasDoc && <Check className="size-3.5" aria-hidden />}
        </button>
      ) : line.status === "cash" ? (
        <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-label="Pagata in contanti" />
      ) : (
        <HelpCircle className="size-4 shrink-0 text-sky-600" aria-label="Da confermare" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate">{line.description}</p>
        <p className="text-muted-foreground text-xs">
          {fmtDate(line.date)} · {line.account}
          {line.status === "cash" && " · in contanti: non vale"}
          {line.status === "check" && ` · da confermare${line.reason ? `: ${line.reason}` : ""}`}
        </p>
      </div>
      <span className="tabular-nums">{money(line.amount)}</span>
      {line.status === "check" && line.type && (
        <span className="flex gap-1">
          <Button
            size="xs"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => setDeduction(line.id, line.type), "Aggiunta al 730")}
          >
            Conta
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => setDeduction(line.id, "none"), "Tolta dal 730")}
          >
            Non conta
          </Button>
        </span>
      )}
    </li>
  );
}
