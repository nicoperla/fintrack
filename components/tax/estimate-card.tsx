"use client";

import { useRef, useState } from "react";
import { Calculator, FileUp, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TaxSection, TONE_BOX, TONE_TEXT } from "@/components/tax/ui";
import { pdfPages } from "@/components/tax/read-pdf";
import { parseCu } from "@/lib/tax/cu-reader";
import { saveCu } from "@/app/(dashboard)/730/actions";
import {
  CU_KINDS,
  CU_KIND_LABELS,
  type CuData,
  type CuKind,
  type Simulation,
} from "@/lib/tax/simulate";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type Row = { kind: CuKind; income: string; days: string; withheld: string; fixedTerm: boolean };

const toText = (n: number) => (n ? n.toFixed(2).replace(".", ",").replace(",00", "") : "");
const emptyRow = (): Row => ({
  kind: "employee",
  income: "",
  days: "365",
  withheld: "",
  fixedTerm: false,
});

const BOXES: Record<CuKind, { income: string; days: string }> = {
  employee: { income: "Punto 1 (o 2 se a tempo determinato)", days: "Punto 6" },
  pensioner: { income: "Punto 3", days: "Punto 7" },
  other: { income: "Compensi lordi", days: "—" },
};

/**
 * The estimate from the Certificazioni Uniche: four figures per CU and the result of the 730,
 * refund or debt, with the advance for next year when there's a debt.
 */
export function EstimateCard({
  year,
  cu,
  simulation,
  moreEmployers,
  pro,
}: {
  year: number;
  cu: CuData;
  simulation: Simulation | null;
  moreEmployers: boolean;
  /** Reading the CU from its PDF is part of Pro, like the precompilato. */
  pro: boolean;
}) {
  const money = useMoney();
  const [editing, setEditing] = useState(cu.entries.length === 0);
  const [rows, setRows] = useState<Row[]>(
    cu.entries.length
      ? cu.entries.map((e) => ({
          kind: e.kind,
          income: toText(e.income),
          days: String(e.days),
          withheld: toText(e.withheld),
          fixedTerm: e.fixedTerm,
        }))
      : moreEmployers
        ? [emptyRow(), emptyRow()]
        : [emptyRow()],
  );
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, setPending] = useState(false);
  const set = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  /** Each PDF read fills the empty rows first, then adds new ones: the user checks and saves. */
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setReading(true);
    let read = 0;
    let failed = 0;
    for (const file of Array.from(files).slice(0, 6)) {
      try {
        const cuRead = parseCu(await pdfPages(file, 12));
        if (!cuRead) {
          failed++;
          continue;
        }
        read++;
        const filled = cuRead.entries.map((e) => ({
          kind: e.kind,
          income: toText(e.income),
          days: String(e.days),
          withheld: toText(e.withheld),
          fixedTerm: e.fixedTerm,
        }));
        setRows((prev) => {
          const next = [...prev];
          for (const row of filled) {
            const empty = next.findIndex((r) => !r.income.trim() && !r.withheld.trim());
            if (empty >= 0) next[empty] = row;
            else if (next.length < 6) next.push(row);
          }
          return next;
        });
      } catch (error) {
        console.error("[cu]", error);
        failed++;
      }
    }
    setReading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (read)
      toast.success(
        read === 1
          ? "CU letta: controlla i numeri e premi Calcola"
          : `${read} CU lette: controlla i numeri e premi Calcola`,
      );
    if (failed) toast.error("Non riesco a leggere i riquadri della CU: scrivi i numeri a mano.");
  }

  async function save(entries: Row[]) {
    setPending(true);
    const res = await saveCu(year, {
      entries: entries.map((r) => ({
        kind: r.kind,
        income: r.income,
        days: r.kind === "other" ? "0" : r.days,
        withheld: r.withheld,
        fixedTerm: r.kind === "employee" && r.fixedTerm,
      })),
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setPending(false);
    setErrors(res.fieldErrors ?? {});
    if (res.ok) {
      toast.success(entries.length ? "Ho rifatto la stima" : "CU tolte");
      setEditing(entries.length === 0);
    } else if (res.error) toast.error(res.error);
    else toast.error("Controlla i numeri della CU");
  }

  const result = simulation?.result ?? 0;
  const tone = !simulation ? "info" : result > 0 ? "good" : result < 0 ? "warn" : "info";

  return (
    <TaxSection
      id="stima"
      icon={Calculator}
      title="La stima dalla CU"
      subtitle="Con i numeri della Certificazione Unica ti dico se avrai un rimborso o un debito."
      aside={
        simulation && !editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Modifica le CU
          </Button>
        ) : null
      }
    >
      {simulation && !editing && (
        <div className={cn("grid gap-3 rounded-xl border p-4", TONE_BOX[tone])}>
          <div>
            <p className="text-muted-foreground text-sm">
              {result > 0
                ? "Rimborso stimato"
                : result < 0
                  ? "Debito stimato"
                  : "Risultato stimato"}
            </p>
            <p
              className={cn("text-4xl font-semibold tracking-tight tabular-nums", TONE_TEXT[tone])}
            >
              {money(Math.abs(result))}
            </p>
            {simulation.advance.total > 0 && (
              <p className="mt-1 text-sm">
                In più c&apos;è l&apos;acconto per l&apos;anno dopo,{" "}
                {money(simulation.advance.total)}:{" "}
                {simulation.advance.july > 0
                  ? `${money(simulation.advance.july)} a luglio insieme al saldo e ${money(simulation.advance.november)} a novembre`
                  : "tutto a novembre"}
                . Se pensi di guadagnare meno l&apos;anno dopo, puoi chiedere per iscritto al datore
                di lavoro, entro il 10 ottobre, di trattenerne meno.
              </p>
            )}
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Reddito complessivo</dt>
            <dd className="text-right tabular-nums">{money(simulation.income)}</dd>
            <dt className="text-muted-foreground">IRPEF lorda</dt>
            <dd className="text-right tabular-nums">{money(simulation.grossTax)}</dd>
            {[
              ["Detrazione per lavoro o pensione", simulation.workDeduction],
              ["Taglio del cuneo fiscale", simulation.extraDeduction],
              ["Familiari a carico", simulation.familyDeduction],
              ["Spese detraibili", simulation.expensesDeduction],
              ["Affitto", simulation.rentDeduction],
            ]
              .filter(([, v]) => (v as number) > 0)
              .map(([label, v]) => (
                <div key={label as string} className="contents">
                  <dt className="text-muted-foreground">− {label}</dt>
                  <dd className="text-right tabular-nums">{money(v as number)}</dd>
                </div>
              ))}
            <dt className="font-medium">IRPEF dovuta</dt>
            <dd className="text-right font-medium tabular-nums">{money(simulation.netTax)}</dd>
            <dt className="text-muted-foreground">IRPEF già trattenuta</dt>
            <dd className="text-right tabular-nums">{money(simulation.withheld)}</dd>
          </dl>
          <p className="text-muted-foreground text-xs">
            Stima con l&apos;IRPEF {year} (aliquota marginale{" "}
            {Math.round(simulation.marginalRate * 100)}
            %). Non conta le addizionali regionale e comunale, il trattamento integrativo e la somma
            esente per chi guadagna fino a 20.000 € (li gestisce già il datore di lavoro), né
            redditi che non sono in una CU.
          </p>
        </div>
      )}

      {editing && (
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save(rows);
          }}
        >
          <p className="bg-muted/40 rounded-xl p-3 text-sm">
            La CU te la danno il datore di lavoro o l&apos;INPS entro il 16 marzo, e la trovi anche
            nel precompilato. Servono quattro numeri per ogni CU: il reddito, i giorni, le ritenute
            IRPEF (punto 21) e se il contratto era a tempo determinato.
          </p>
          {pro && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                multiple
                className="sr-only"
                id="cu-file"
                onChange={(e) => void onFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={reading}
                onClick={() => fileRef.current?.click()}
              >
                {reading ? <Loader2 className="animate-spin" /> : <FileUp />}
                {reading ? "Leggo…" : "Leggi la CU dal PDF"}
              </Button>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <ShieldCheck className="size-3.5" aria-hidden /> La leggo nel tuo browser: non la
                invio e non la salvo. Lettura in prova: controlla i numeri.
              </p>
            </div>
          )}
          {rows.map((r, i) => {
            const err = (field: string) => errors[`entries.${i}.${field}`]?.[0];
            return (
              <fieldset key={i} className="grid gap-3 rounded-xl border p-3">
                <legend className="px-1 text-sm font-medium">CU {i + 1}</legend>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground text-xs">Tipo di reddito</span>
                    <NativeSelect
                      value={r.kind}
                      onChange={(e) => set(i, { kind: e.target.value as CuKind })}
                      className="w-full"
                    >
                      {CU_KINDS.map((k) => (
                        <NativeSelectOption key={k} value={k}>
                          {CU_KIND_LABELS[k]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground text-xs">
                      Reddito · {BOXES[r.kind].income}
                    </span>
                    <Input
                      inputMode="decimal"
                      placeholder="Es. 24.500"
                      value={r.income}
                      onChange={(e) => set(i, { income: e.target.value })}
                      aria-invalid={err("income") ? true : undefined}
                    />
                  </label>
                  {r.kind !== "other" && (
                    <label className="grid gap-1 text-sm">
                      <span className="text-muted-foreground text-xs">
                        Giorni · {BOXES[r.kind].days}
                      </span>
                      <Input
                        inputMode="numeric"
                        placeholder="365"
                        value={r.days}
                        onChange={(e) => set(i, { days: e.target.value })}
                        aria-invalid={err("days") ? true : undefined}
                      />
                    </label>
                  )}
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground text-xs">Ritenute IRPEF · punto 21</span>
                    <Input
                      inputMode="decimal"
                      placeholder="Es. 3.900"
                      value={r.withheld}
                      onChange={(e) => set(i, { withheld: e.target.value })}
                      aria-invalid={err("withheld") ? true : undefined}
                    />
                  </label>
                </div>
                {["income", "days", "withheld"].map(
                  (f) =>
                    err(f) && (
                      <p key={f} className="text-destructive text-xs">
                        {err(f)}
                      </p>
                    ),
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {r.kind === "employee" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={r.fixedTerm}
                        onChange={(e) => set(i, { fixedTerm: e.target.checked })}
                      />
                      Contratto a tempo determinato
                    </label>
                  ) : (
                    <span />
                  )}
                  {rows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 /> Togli
                    </Button>
                  )}
                </div>
              </fieldset>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rows.length >= 6}
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
            >
              <Plus /> Un&apos;altra CU
            </Button>
            <div className="flex gap-2">
              {cu.entries.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => void save([])}
                >
                  Togli tutto
                </Button>
              )}
              <Button type="submit" disabled={pending}>
                {pending ? "Calcolo…" : "Calcola"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </TaxSection>
  );
}
