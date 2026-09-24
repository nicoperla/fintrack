import Papa from "papaparse";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Decodes as UTF-8, falling back to Windows-1252 (common in Italian bank exports). */
export async function readTextFile(file: File) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

export function parseCsv(text: string): string[][] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy", delimiter: "" });
  return result.data.map((row) => row.map((cell) => (cell ?? "").trim()));
}

/**
 * Bank exports often start with a preamble (account holder, period...), sometimes padded to the
 * table width by Excel ("Intestatario;Mario;;;"). The table width is the most common column count;
 * the header is the first row of that width with every cell named, falling back to the first
 * row of that width with at least two cells (debit/credit data rows always leave one cell empty).
 */
export function detectHeaderRow(records: string[][]) {
  const counts = new Map<number, number>();
  for (const r of records) {
    if (r.length >= 2) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
  }
  const [tableWidth] = Array.from(counts).sort((a, b) => b[1] - a[1])[0] ?? [0];
  const filled = (r: string[]) => r.filter(Boolean).length;
  const complete = records.findIndex((r) => r.length === tableWidth && filled(r) === tableWidth);
  if (complete !== -1) return complete;
  return Math.max(
    0,
    records.findIndex((r) => r.length === tableWidth && filled(r) >= 2),
  );
}
