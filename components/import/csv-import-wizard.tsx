"use client";

import { useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-field";
import { findDuplicates, importTransactions } from "@/app/(dashboard)/transactions/import/actions";
import {
  buildImportRows,
  DATE_FORMATS,
  guessMapping,
  MAX_IMPORT_ROWS,
  type ColumnMapping,
  type ImportRow,
} from "@/lib/import/csv";
import { detectHeaderRow, MAX_FILE_BYTES, parseCsv, readTextFile } from "@/lib/import/read-file";

import { formatDate } from "@/lib/format";
import { useMoney } from "@/components/currency-provider";
import type { AccountOption } from "@/lib/dto";
import { cn } from "@/lib/utils";

type Step = "upload" | "mapping" | "review" | "done";
type Parsed = { fileName: string; records: string[][] };

const STORAGE_PREFIX = "fintrack.csvMapping:";

function loadSavedMapping(signature: string): (ColumnMapping & { accountId?: string }) | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + signature);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMapping(signature: string, value: ColumnMapping & { accountId: string }) {
  try {
    localStorage.setItem(STORAGE_PREFIX + signature, JSON.stringify(value));
  } catch {
    // Remembering the mapping is a convenience; ignore storage failures.
  }
}

const columnLetter = (i: number) => String.fromCharCode(65 + (i % 26));

function StepIndicator({ step }: { step: Step }) {
  const steps: [Step, string][] = [
    ["upload", "File"],
    ["mapping", "Colonne"],
    ["review", "Controllo"],
  ];
  const current = steps.findIndex(([s]) => s === step);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map(([s, label], i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border text-[11px] font-medium",
              i < current || step === "done"
                ? "bg-primary text-primary-foreground border-transparent"
                : i === current
                  ? "border-foreground"
                  : "text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
          <span className={i === current ? "font-medium" : "text-muted-foreground"}>{label}</span>
          {i < steps.length - 1 && <span className="bg-border h-px w-6" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function ColumnSelect({
  id,
  label,
  value,
  onChange,
  headers,
  sample,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  headers: string[];
  sample: string[];
}) {
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        className="w-full"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {headers.map((h, i) => (
          <NativeSelectOption key={i} value={i}>
            {`${columnLetter(i)} · ${h || "(senza nome)"}`}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <p className="text-muted-foreground truncate text-xs">Es. {sample[value] || "—"}</p>
    </div>
  );
}

export function CsvImportWizard({ accounts }: { accounts: AccountOption[] }) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [duplicates, setDuplicates] = useState<boolean[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ imported: number; categorized: number } | null>(null);

  const headers = parsed?.records[headerRow] ?? [];
  const dataRecords = useMemo(
    () => parsed?.records.slice(headerRow + 1) ?? [],
    [parsed, headerRow],
  );
  const signature = headers.join("|").toLowerCase();

  const built = useMemo(
    () =>
      mapping ? buildImportRows(dataRecords, mapping, headerRow + 2) : { rows: [], errors: [] },
    [dataRecords, mapping, headerRow],
  );

  async function handleFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError("Il file è troppo grande (massimo 5 MB).");
      return;
    }
    const records = parseCsv(await readTextFile(file));
    if (records.length < 2) {
      setFileError("Non ho trovato righe da importare. Controlla che sia un file CSV.");
      return;
    }
    const header = detectHeaderRow(records);
    const fileHeaders = records[header];
    const saved = loadSavedMapping(fileHeaders.join("|").toLowerCase());
    setParsed({ fileName: file.name, records });
    setHeaderRow(header);
    setMapping(saved ?? guessMapping(fileHeaders, records.slice(header + 1, header + 11)));
    if (saved?.accountId && accounts.some((a) => a.id === saved.accountId))
      setAccountId(saved.accountId);
    setStep("mapping");
  }

  function changeHeaderRow(index: number) {
    if (!parsed) return;
    setHeaderRow(index);
    setMapping(guessMapping(parsed.records[index], parsed.records.slice(index + 1, index + 11)));
  }

  const update = (patch: Partial<ColumnMapping>) => setMapping((m) => (m ? { ...m, ...patch } : m));

  async function goToReview() {
    if (!mapping || built.rows.length === 0) return;
    if (built.rows.length > MAX_IMPORT_ROWS) {
      toast.error(`Puoi importare al massimo ${MAX_IMPORT_ROWS} righe alla volta.`);
      return;
    }
    setPending(true);
    saveMapping(signature, { ...mapping, accountId });
    const flags =
      (await findDuplicates({ accountId, rows: built.rows }).catch(() => null)) ??
      built.rows.map(() => false);
    setDuplicates(flags);
    setSelected(
      new Set(built.rows.map((r, i) => (flags[i] ? -1 : r.line)).filter((l) => l !== -1)),
    );
    setPending(false);
    setStep("review");
  }

  async function runImport() {
    const rows = built.rows.filter((r) => selected.has(r.line));
    if (rows.length === 0) return;
    setPending(true);
    const res = await importTransactions({ accountId, rows }).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      toast.error(res?.error ?? "Import non riuscito. Riprova.");
      return;
    }
    setResult({ imported: res.imported ?? 0, categorized: res.categorized ?? 0 });
    setStep("done");
  }

  function reset() {
    setParsed(null);
    setMapping(null);
    setResult(null);
    setStep("upload");
  }

  function toggle(row: ImportRow) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row.line)) next.delete(row.line);
      else next.add(row.line);
      return next;
    });
  }

  const sample = dataRecords[0] ?? [];
  const accountName = accounts.find((a) => a.id === accountId)?.name ?? "";
  const currency = accounts.find((a) => a.id === accountId)?.currency;
  const selectedRows = built.rows.filter((r) => selected.has(r.line));
  const duplicateCount = duplicates.filter(Boolean).length;

  if (step === "done" && result) {
    return (
      <div className="bg-card flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center">
        <CheckCircle2 className="size-10 text-(--delta-good)" aria-hidden />
        <h2 className="text-lg font-medium">
          {result.imported === 1
            ? "1 movimento importato"
            : `${result.imported} movimenti importati`}
        </h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Sono stati aggiunti a {accountName} con il tag #importato.{" "}
          {result.categorized > 0
            ? `${result.categorized} hanno ricevuto in automatico la categoria dei tuoi movimenti simili.`
            : "Puoi assegnare le categorie dalla lista dei movimenti."}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link
            href={`/transactions?${new URLSearchParams({ accountId, q: "importato" })}`}
            className={buttonVariants()}
          >
            Vedi i movimenti importati
          </Link>
          <Button variant="outline" onClick={reset}>
            Importa un altro file
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <StepIndicator step={step} />

      {step === "upload" && (
        <div className="grid gap-3">
          <label
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files[0]);
            }}
            className={cn(
              "has-focus-visible:ring-ring/50 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors has-focus-visible:ring-3",
              dragging ? "border-primary bg-muted" : "hover:bg-muted/50",
            )}
          >
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <Upload className="text-muted-foreground size-6" aria-hidden />
            </div>
            <span className="font-medium">Trascina qui l&apos;estratto conto</span>
            <span className="text-muted-foreground text-sm">
              oppure clicca per scegliere un file CSV (max 5 MB)
            </span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {fileError && <FormMessage tone="error">{fileError}</FormMessage>}
          <p className="text-muted-foreground text-xs">
            Il file viene letto nel tuo browser: sul server arrivano solo i movimenti che confermi.
          </p>
        </div>
      )}

      {step === "mapping" && parsed && mapping && (
        <div className="grid gap-6">
          <div className="bg-card flex items-center gap-3 rounded-xl border p-4">
            <FileSpreadsheet className="text-muted-foreground size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{parsed.fileName}</p>
              <p className="text-muted-foreground text-xs">
                {dataRecords.length} righe · {headers.length} colonne
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              Cambia file
            </Button>
          </div>

          <section className="bg-card grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
            <div className="grid content-start gap-2">
              <Label htmlFor="import-account">Importa nel conto</Label>
              <NativeSelect
                id="import-account"
                className="w-full"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="import-header">Riga di intestazione</Label>
              <NativeSelect
                id="import-header"
                className="w-full"
                value={headerRow}
                onChange={(e) => changeHeaderRow(Number(e.target.value))}
              >
                {parsed.records.slice(0, 15).map((r, i) => (
                  <NativeSelectOption key={i} value={i}>
                    {`Riga ${i + 1}: ${r.filter(Boolean).join(" · ").slice(0, 60)}`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <ColumnSelect
              id="col-date"
              label="Colonna data"
              value={mapping.dateColumn}
              onChange={(v) => update({ dateColumn: v })}
              headers={headers}
              sample={sample}
            />
            <div className="grid content-start gap-2">
              <Label htmlFor="date-format">Formato data</Label>
              <NativeSelect
                id="date-format"
                className="w-full"
                value={mapping.dateFormat}
                onChange={(e) =>
                  update({ dateFormat: e.target.value as ColumnMapping["dateFormat"] })
                }
              >
                {DATE_FORMATS.map((f) => (
                  <NativeSelectOption key={f} value={f}>
                    {f.replace("DD", "GG").replace("YYYY", "AAAA").replace("YY", "AA")}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="sm:col-span-2">
              <ColumnSelect
                id="col-description"
                label="Colonna descrizione"
                value={mapping.descriptionColumn}
                onChange={(v) => update({ descriptionColumn: v })}
                headers={headers}
                sample={sample}
              />
            </div>

            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">Importi</legend>
              <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1 text-sm">
                {(
                  [
                    ["single", "Una colonna con segno"],
                    ["split", "Colonne separate uscite/entrate"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={cn(
                      "has-focus-visible:ring-ring/50 cursor-pointer rounded-md px-2 py-1.5 text-center transition-colors has-focus-visible:ring-3",
                      mapping.amountMode === value
                        ? "bg-background font-medium shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="amountMode"
                      value={value}
                      checked={mapping.amountMode === value}
                      onChange={() => update({ amountMode: value })}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {mapping.amountMode === "single" ? (
              <ColumnSelect
                id="col-amount"
                label="Colonna importo"
                value={mapping.amountColumn}
                onChange={(v) => update({ amountColumn: v })}
                headers={headers}
                sample={sample}
              />
            ) : (
              <>
                <ColumnSelect
                  id="col-debit"
                  label="Colonna uscite (dare)"
                  value={mapping.debitColumn}
                  onChange={(v) => update({ debitColumn: v })}
                  headers={headers}
                  sample={sample}
                />
                <ColumnSelect
                  id="col-credit"
                  label="Colonna entrate (avere)"
                  value={mapping.creditColumn}
                  onChange={(v) => update({ creditColumn: v })}
                  headers={headers}
                  sample={sample}
                />
              </>
            )}
            <label className="flex items-center gap-2 self-end text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={mapping.invertSign}
                onChange={(e) => update({ invertSign: e.target.checked })}
                className="accent-primary size-4"
              />
              Nel file le uscite sono numeri positivi (tipico degli estratti conto delle carte)
            </label>
          </section>

          <section className="grid gap-2" aria-label="Anteprima">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">Anteprima</h2>
              <p className="text-muted-foreground text-xs">
                {built.rows.length} righe valide
                {built.errors.length > 0 && ` · ${built.errors.length} scartate`}
              </p>
            </div>
            <PreviewTable rows={built.rows.slice(0, 6)} currency={currency} />
            {built.errors.length > 0 && (
              <details className="text-muted-foreground text-xs">
                <summary className="cursor-pointer">Mostra le righe scartate</summary>
                <ul className="mt-2 grid gap-1">
                  {built.errors.slice(0, 50).map((e) => (
                    <li key={e.line}>
                      Riga {e.line}: {e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <div className="flex justify-end">
            <Button onClick={goToReview} disabled={pending || built.rows.length === 0}>
              {pending ? "Controllo duplicati…" : `Continua con ${built.rows.length} movimenti`}
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="grid gap-4">
          {duplicateCount > 0 && (
            <div className="bg-muted flex items-start gap-2 rounded-lg p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-(--warn-text)" aria-hidden />
              <p>
                {duplicateCount === 1
                  ? "1 movimento sembra già presente"
                  : `${duplicateCount} movimenti sembrano già presenti`}{" "}
                in {accountName} (stessa data, importo e tipo): li ho deselezionati. Selezionali se
                vuoi importarli comunque.
              </p>
            </div>
          )}
          <div className="bg-card max-h-[60svh] overflow-y-auto rounded-xl border">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-card text-muted-foreground sticky top-0 text-left text-xs">
                <tr className="border-b">
                  <th className="w-10 p-2">
                    <input
                      type="checkbox"
                      aria-label="Seleziona tutti"
                      checked={selected.size === built.rows.length}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? new Set(built.rows.map((r) => r.line)) : new Set(),
                        )
                      }
                      className="accent-primary size-4"
                    />
                  </th>
                  <th className="w-28 p-2 font-medium">Data</th>
                  <th className="p-2 font-medium">Descrizione</th>
                  <th className="w-28 p-2 text-right font-medium">Importo</th>
                </tr>
              </thead>
              <tbody>
                {built.rows.map((row, i) => (
                  <tr
                    key={row.line}
                    className={cn(
                      "border-b last:border-0",
                      !selected.has(row.line) && "opacity-50",
                    )}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        aria-label={`Importa ${row.description}`}
                        checked={selected.has(row.line)}
                        onChange={() => toggle(row)}
                        className="accent-primary size-4"
                      />
                    </td>
                    <td className="text-muted-foreground p-2 whitespace-nowrap">
                      {formatDate(new Date(`${row.date}T00:00:00Z`))}
                    </td>
                    <td className="max-w-0 p-2">
                      <span className="block truncate">{row.description}</span>
                      {duplicates[i] && (
                        <span className="text-xs text-(--warn-text)">Possibile duplicato</span>
                      )}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap tabular-nums">
                      <AmountCell row={row} currency={currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep("mapping")} disabled={pending}>
              Indietro
            </Button>
            <Button onClick={runImport} disabled={pending || selectedRows.length === 0}>
              {pending
                ? "Importazione…"
                : `Importa ${selectedRows.length} ${selectedRows.length === 1 ? "movimento" : "movimenti"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AmountCell({ row, currency }: { row: ImportRow; currency?: string }) {
  const money = useMoney();
  return row.type === "INCOME" ? (
    <span className="text-emerald-600 dark:text-emerald-400">+{money(row.amount, currency)}</span>
  ) : (
    <span>−{money(row.amount, currency)}</span>
  );
}

function PreviewTable({ rows, currency }: { rows: ImportRow[]; currency?: string }) {
  if (rows.length === 0) {
    return (
      <p className="bg-card text-muted-foreground rounded-xl border p-6 text-center text-sm">
        Nessuna riga valida con questa mappatura: controlla le colonne e il formato della data.
      </p>
    );
  }
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-28" />
          <col />
          <col className="w-28" />
        </colgroup>
        <tbody>
          {rows.map((row) => (
            <tr key={row.line} className="border-b last:border-0">
              <td className="text-muted-foreground p-2 whitespace-nowrap">
                {formatDate(new Date(`${row.date}T00:00:00Z`))}
              </td>
              <td className="max-w-0 p-2">
                <span className="block truncate">{row.description}</span>
              </td>
              <td className="p-2 text-right whitespace-nowrap tabular-nums">
                <AmountCell row={row} currency={currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
