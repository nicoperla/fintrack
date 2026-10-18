"use client";

import type { PdfPage } from "@/lib/tax/cu-reader";

/*
 * The text of a PDF, read in the browser with pdf.js: the file never leaves the device. Used for
 * the precompilato and the CU, full of health and income data. Each piece of text keeps its
 * position, so a row of the form ("E8 29 450,00") or the value inside a numbered box can be
 * found again.
 */

export async function pdfPages(file: File, maxPages = 40): Promise<PdfPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.min.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const pages: PdfPage[] = [];
  try {
    for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      pages.push({
        items: content.items.flatMap((item) =>
          "str" in item && item.str.trim()
            ? [{ str: item.str, x: item.transform[4], y: item.transform[5] }]
            : [],
        ),
      });
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}

/** The text one row at a time: pieces within 2 points vertically belong to the same row. */
export async function pdfLines(file: File): Promise<string[]> {
  const lines: string[] = [];
  for (const { items } of await pdfPages(file)) {
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of items) {
      const y = Math.round(item.y / 2) * 2;
      const row = rows.get(y) ?? [];
      row.push({ x: item.x, s: item.str });
      rows.set(y, row);
    }
    for (const y of Array.from(rows.keys()).sort((a, b) => b - a)) {
      lines.push(
        rows
          .get(y)!
          .sort((a, b) => a.x - b.x)
          .map((i) => i.s)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      );
    }
  }
  return lines;
}
