export const MAX_IMPORT_ROWS = 2000;

export const DATE_FORMATS = [
  "DD/MM/YYYY",
  "YYYY-MM-DD",
  "DD-MM-YYYY",
  "DD.MM.YYYY",
  "DD/MM/YY",
] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

const DATE_PATTERNS: Record<DateFormat, RegExp> = {
  "DD/MM/YYYY": /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  "YYYY-MM-DD": /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  "DD-MM-YYYY": /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  "DD.MM.YYYY": /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
  "DD/MM/YY": /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
};

/** Returns "YYYY-MM-DD" or null. Ignores a trailing time part ("12/09/2026 14:30"). */
export function parseDate(input: string, format: DateFormat): string | null {
  const value = input.trim().split(/[ T]/)[0];
  const match = value.match(DATE_PATTERNS[format]);
  if (!match) return null;
  const [rawYear, month, day] =
    format === "YYYY-MM-DD"
      ? [Number(match[1]), Number(match[2]), Number(match[3])]
      : [Number(match[3]), Number(match[2]), Number(match[1])];
  const year = format === "DD/MM/YY" ? rawYear + 2000 : rawYear;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function detectDateFormat(samples: string[]): DateFormat | null {
  const values = samples.map((s) => s.trim()).filter(Boolean);
  if (values.length === 0) return null;
  return DATE_FORMATS.find((f) => values.every((v) => parseDate(v, f) !== null)) ?? null;
}

/**
 * Parses bank-statement amounts into a signed canonical string ("-1234.56").
 * Handles "1.234,56", "1,234.56", "-12,50", "12,50-", "(12,50)", "+12,50", "€ 12,50".
 */
export function parseSignedCsvAmount(input: string): string | null {
  let value = input.replace(/[\s €$£]|EUR/gi, "");
  if (!value) return null;

  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith("-") || value.endsWith("-")) {
    negative = !negative;
    value = value.replace(/^-|-$/g, "");
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // The separator that comes last is the decimal one.
    value =
      lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (lastComma > -1) {
    value =
      /^\d{1,3}(,\d{3})+$/.test(value) && !/,\d{1,2}$/.test(value)
        ? value.replace(/,/g, "")
        : value.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replace(/\./g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const rounded = (Math.round(Number(value) * 100) / 100).toFixed(2);
  if (rounded === "0.00") return "0.00";
  return negative ? `-${rounded}` : rounded;
}

export type ColumnMapping = {
  dateColumn: number;
  descriptionColumn: number;
  dateFormat: DateFormat;
  /** One signed column, or separate columns for money out (debit) and money in (credit). */
  amountMode: "single" | "split";
  amountColumn: number;
  debitColumn: number;
  creditColumn: number;
  /** Some exports (e.g. credit card statements) list expenses as positive numbers. */
  invertSign: boolean;
};

const normalize = (h: string) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function findColumn(headers: string[], candidates: RegExp[], exclude?: RegExp) {
  for (const candidate of candidates) {
    const index = headers.findIndex(
      (h) => candidate.test(normalize(h)) && !exclude?.test(normalize(h)),
    );
    if (index !== -1) return index;
  }
  return -1;
}

export function guessMapping(headers: string[], sampleRows: string[][]): ColumnMapping {
  const dateColumn = findColumn(
    headers,
    [/data (operazione|contabile|registrazione)/, /^data$/, /^date$/, /data/, /date/],
    /valuta/,
  );
  const descriptionColumn = findColumn(headers, [
    /descrizione/,
    /causale/,
    /dettagli/,
    /description/,
    /beneficiario|esercente|operazione/,
  ]);
  const amountColumn = findColumn(headers, [/^importo/, /importo/, /amount/, /^valore/]);
  const debitColumn = findColumn(headers, [/^dare$/, /uscit/, /addebit/, /debit/]);
  const creditColumn = findColumn(headers, [/^avere$/, /entrat/, /accredit/, /credit/]);

  const amountMode =
    amountColumn === -1 && debitColumn !== -1 && creditColumn !== -1 ? "split" : "single";
  const dateSamples = dateColumn === -1 ? [] : sampleRows.map((r) => r[dateColumn] ?? "");

  return {
    dateColumn: dateColumn === -1 ? 0 : dateColumn,
    descriptionColumn:
      descriptionColumn === -1 ? Math.min(1, headers.length - 1) : descriptionColumn,
    dateFormat: detectDateFormat(dateSamples) ?? "DD/MM/YYYY",
    amountMode,
    amountColumn: amountColumn === -1 ? Math.min(2, headers.length - 1) : amountColumn,
    debitColumn: debitColumn === -1 ? 0 : debitColumn,
    creditColumn: creditColumn === -1 ? 0 : creditColumn,
    invertSign: false,
  };
}

export type ImportRow = {
  line: number;
  date: string;
  description: string;
  amount: string;
  type: "INCOME" | "EXPENSE";
};
export type ImportError = { line: number; reason: string };

const MAX_DESCRIPTION = 120;

/** Turns raw CSV records into importable rows. `firstLine` is the file line number of records[0]. */
export function buildImportRows(records: string[][], mapping: ColumnMapping, firstLine = 2) {
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];

  records.forEach((record, i) => {
    const line = firstLine + i;
    if (record.every((cell) => !cell?.trim())) return;

    const date = parseDate(record[mapping.dateColumn] ?? "", mapping.dateFormat);
    if (!date) {
      errors.push({ line, reason: `Data non valida: "${record[mapping.dateColumn] ?? ""}"` });
      return;
    }

    let signed: string | null;
    if (mapping.amountMode === "single") {
      signed = parseSignedCsvAmount(record[mapping.amountColumn] ?? "");
    } else {
      const debit = parseSignedCsvAmount(record[mapping.debitColumn] ?? "");
      const credit = parseSignedCsvAmount(record[mapping.creditColumn] ?? "");
      const debitAbs = debit ? Math.abs(Number(debit)) : 0;
      const creditAbs = credit ? Math.abs(Number(credit)) : 0;
      signed = debit === null && credit === null ? null : (creditAbs - debitAbs).toFixed(2);
    }
    if (signed === null) {
      errors.push({ line, reason: "Importo non valido" });
      return;
    }
    let value = Number(signed);
    if (mapping.invertSign) value = -value;
    if (value === 0) {
      errors.push({ line, reason: "Importo pari a zero" });
      return;
    }

    const description = (record[mapping.descriptionColumn] ?? "").replace(/\s+/g, " ").trim();
    rows.push({
      line,
      date,
      description: (description || "Movimento importato").slice(0, MAX_DESCRIPTION),
      amount: Math.abs(value).toFixed(2),
      type: value > 0 ? "INCOME" : "EXPENSE",
    });
  });

  return { rows, errors };
}
