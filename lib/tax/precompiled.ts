import type { DeductionType } from "@/lib/finance/deductions";

/*
 * Reading the precompilato. The PDF the Agenzia lets you download is the 730 form filled in: the
 * lines of quadro E start with their name ("E1", "E8"…), followed by codes and amounts. The text
 * is extracted in the browser (pdf.js) and parsed here: nothing leaves the device, because the
 * precompilato is full of health data.
 *
 * The reading is tolerant and conservative: an amount it isn't sure about is left out, and the
 * user can always correct or type the totals by hand.
 */

/** Codes of lines E8–E10 (and E7) mapped to Orbitly's deduction types. */
export const CODE_TYPES: Record<string, DeductionType> = {
  "7": "mutuo",
  "48": "mutuo",
  "57": "mutuo",
  "12": "istruzione",
  "13": "universita",
  "14": "funebri",
  "16": "sport",
  "18": "studenti",
  "29": "veterinarie",
  "33": "asilo",
  "36": "assicurazione",
  "51": "assicurazione",
  "40": "trasporto",
  "71": "donazioni",
  "76": "donazioni",
};

export type PrecompiledReading = {
  /** Totals by deduction type found in quadro E. */
  totals: Partial<Record<DeductionType, number>>;
  /** Line E71 (rent) is filled in. */
  rent: boolean;
  /** Lines recognized, for the "here's what I read" list. */
  found: { line: string; code?: string; amount: number }[];
};

/** "1.234,56" or "1234,56" or "1.234" (whole euros): the amounts of the form. */
const AMOUNT = /(?<![\d,.])\d{1,3}(?:\.\d{3})+(?:,\d{2})?(?![\d,])|(?<![\d,.])\d+,\d{2}(?![\d,])/g;

export function parseItalianAmount(text: string) {
  const n = Number(text.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const add = (totals: PrecompiledReading["totals"], type: DeductionType, amount: number) => {
  totals[type] = Math.round(((totals[type] ?? 0) + amount) * 100) / 100;
};

/**
 * The quadro E lines of a precompilato, from its text lines (one per row of the page). A line
 * counts only if it starts with its name and has an amount with cents or thousands: plain small
 * numbers are codes, columns and days.
 */
export function parsePrecompiled(lines: string[]): PrecompiledReading {
  const totals: PrecompiledReading["totals"] = {};
  const found: PrecompiledReading["found"] = [];
  let rent = false;

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const head = /^(E\d{1,2})\b(.*)$/.exec(line);
    if (!head) continue;
    const name = head[1];
    const rest = head[2];
    const formatted = Array.from(rest.matchAll(AMOUNT))
      .map((m) => parseItalianAmount(m[0]))
      .filter((n): n is number => n !== null && n > 0);
    // Some PDFs print whole euros without cents: then the last number is the amount, as long as
    // it's not a column number (and, on the coded lines, there's a code before it).
    const integers = (rest.match(/\b\d+\b/g) ?? []).map(Number);
    const coded = name === "E7" || name === "E8" || name === "E9" || name === "E10";
    const last = integers[integers.length - 1];
    const amounts =
      formatted.length > 0
        ? formatted
        : last >= 10 && (!coded || integers.length >= 2)
          ? [last]
          : [];

    if (name === "E71") {
      // Type, days, percentage: any figure means the rent deduction is there.
      if (/\b[1-4]\b/.test(rest) || amounts.length) rent = true;
      continue;
    }
    if (!amounts.length) continue;

    if (name === "E1") {
      // Column 2 holds the health expenses: the largest figure of the line.
      const amount = Math.max(...amounts);
      add(totals, "sanitarie", amount);
      found.push({ line: name, amount });
      continue;
    }
    if (coded) {
      // The code comes before the amount: the first small whole number of the line.
      const beforeAmount = formatted.length ? (rest.split(AMOUNT)[0] ?? "") : rest;
      const code = /\b(\d{1,2})\b/.exec(beforeAmount)?.[1];
      const amount = amounts[0];
      const type = code ? CODE_TYPES[code] : name === "E7" ? "mutuo" : undefined;
      if (type) {
        add(totals, type, amount);
        found.push({ line: name, code, amount });
      }
      continue;
    }
    if (name === "E23") {
      add(totals, "colf", amounts[0]);
      found.push({ line: name, amount: amounts[0] });
      continue;
    }
    if (name === "E27") {
      add(totals, "previdenza", amounts[0]);
      found.push({ line: name, amount: amounts[0] });
    }
  }
  return { totals, rent, found };
}
