import type { CuEntry } from "@/lib/tax/simulate";

/*
 * Reading a Certificazione Unica in PDF, in the browser like the precompilato (it says how much
 * someone earns). The CU form has numbered boxes, each with its number in the top-left corner
 * and the value written inside: box 1 (or 2 for a fixed-term contract) is the employment
 * income, 3 the pension, 6 and 7 the days, 21 the IRPEF withheld.
 *
 * Two ways to find a value, the second only when the first finds nothing: by position (the
 * number's row, between it and the next box), and by sequence (the number followed by an
 * amount in the text). The figures fill the estimate's form: the user checks them before
 * saving.
 */

export type PdfItem = { str: string; x: number; y: number };
export type PdfPage = { items: PdfItem[] };

export type CuReading = {
  entries: CuEntry[];
  /** What was read and from which box, to show the user. */
  found: { box: string; value: number }[];
};

/** "24.500,00", "24500,00" or "24500.00": the amounts payroll software prints. */
const AMOUNT = /^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[.,]\d{2})?$/;

export function parseAmountText(text: string): number | null {
  const s = text.replace(/\s|€/g, "");
  if (!AMOUNT.test(s)) return null;
  // A comma is always the decimal mark; a dot is one only before exactly two final digits
  // with no comma ("24500.00"), otherwise it groups thousands.
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : /^\d+\.\d{2}$/.test(s)
      ? s
      : s.replace(/\./g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const ROW = 2.5;

/** The box numbers of one row, left to right: e.g. ["1", "2", "3", "4"]. */
function findRow(items: PdfItem[], labels: string[], below?: number) {
  const first = items.filter(
    (i) => i.str.trim() === labels[0] && (below === undefined || i.y < below),
  );
  for (const start of first) {
    const row = [start];
    for (const label of labels.slice(1)) {
      const next = items.find(
        (i) =>
          i.str.trim() === label && Math.abs(i.y - start.y) < ROW && i.x > row[row.length - 1].x,
      );
      if (!next) break;
      row.push(next);
    }
    if (row.length === labels.length) return row;
  }
  return null;
}

/** The value written in a box: below or beside its number, before the next box. */
function valueByPosition(items: PdfItem[], label: PdfItem, rightBound: number, labels: PdfItem[]) {
  const candidates = items
    .filter((i) => !labels.includes(i))
    .filter((i) => i.x >= label.x - 6 && i.x < rightBound - 2)
    .filter((i) => i.y >= label.y - 18 && i.y <= label.y + 4)
    .map((i) => ({ i, value: parseAmountText(i.str) }))
    .filter((c): c is { i: PdfItem; value: number } => c.value !== null)
    .sort(
      (a, b) =>
        Math.abs(a.i.y - label.y) - Math.abs(b.i.y - label.y) ||
        Math.abs(a.i.x - label.x) - Math.abs(b.i.x - label.x),
    );
  return candidates[0]?.value ?? null;
}

/** The page's words in reading order, for the fallback. */
function tokens(items: PdfItem[]) {
  return [...items]
    .sort((a, b) => (Math.abs(a.y - b.y) < ROW ? a.x - b.x : b.y - a.y))
    .flatMap((i) => i.str.trim().split(/\s+/))
    .filter(Boolean);
}

/** The number of a box followed by an amount, before any other box number. */
function valueBySequence(words: string[], label: string, boxNumbers: Set<string>) {
  for (let k = 0; k < words.length; k++) {
    if (words[k] !== label) continue;
    for (let j = k + 1; j < Math.min(words.length, k + 4); j++) {
      if (boxNumbers.has(words[j])) break;
      // Small integers are other box numbers or days: only amounts with cents or thousands.
      if (/[.,]/.test(words[j])) {
        const value = parseAmountText(words[j]);
        if (value !== null) return value;
      }
    }
  }
  return null;
}

/**
 * The CU's figures, or null when no income can be found. A CU with both work and pension gives
 * two entries; the IRPEF withheld (box 21 is one for both) goes with the first.
 */
export function parseCu(pages: PdfPage[]): CuReading | null {
  for (const page of pages) {
    const { items } = page;
    const incomeRow = findRow(items, ["1", "2", "3", "4"]);
    if (!incomeRow) continue;
    const daysRow = findRow(items, ["5", "6", "7"], incomeRow[0].y);
    const taxRow = findRow(items, ["21", "22"], (daysRow ?? incomeRow)[0].y);
    const rowLabels = [...incomeRow, ...(daysRow ?? []), ...(taxRow ?? [])];
    const words = tokens(items);
    const boxNumbers = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "21", "22", "26", "27"]);

    const read = (row: PdfItem[] | null, index: number, width: number, label: string) => {
      if (row) {
        const bound = row[index + 1]?.x ?? row[index].x + width;
        const value = valueByPosition(items, row[index], bound, rowLabels);
        if (value !== null) return value;
      }
      return valueBySequence(words, label, boxNumbers);
    };

    const permanent = read(incomeRow, 0, 110, "1") ?? 0;
    const fixed = read(incomeRow, 1, 110, "2") ?? 0;
    const pension = read(incomeRow, 2, 110, "3") ?? 0;
    // Days are whole numbers: read by position only, the sequence would mistake box numbers.
    const dayAt = (index: number) => {
      if (!daysRow) return null;
      const bound = daysRow[index + 1]?.x ?? daysRow[index].x + 50;
      const value = valueByPosition(items, daysRow[index], bound, rowLabels);
      return value !== null && Number.isInteger(value) && value >= 0 && value <= 366
        ? Math.min(365, value)
        : null;
    };
    const workDays = dayAt(1);
    const pensionDays = dayAt(2);
    const withheld = read(taxRow, 0, 87, "21") ?? 0;

    const found: CuReading["found"] = [];
    if (permanent) found.push({ box: "1", value: permanent });
    if (fixed) found.push({ box: "2", value: fixed });
    if (pension) found.push({ box: "3", value: pension });
    if (workDays !== null) found.push({ box: "6", value: workDays });
    if (pensionDays !== null) found.push({ box: "7", value: pensionDays });
    if (withheld) found.push({ box: "21", value: withheld });

    const entries: CuEntry[] = [];
    if (permanent + fixed > 0) {
      entries.push({
        kind: "employee",
        income: permanent + fixed,
        days: workDays ?? 365,
        withheld,
        fixedTerm: fixed > 0 && permanent === 0,
      });
    }
    if (pension > 0) {
      entries.push({
        kind: "pensioner",
        income: pension,
        days: pensionDays ?? 365,
        withheld: entries.length ? 0 : withheld,
        fixedTerm: false,
      });
    }
    if (entries.length) return { entries, found };
  }
  return null;
}
