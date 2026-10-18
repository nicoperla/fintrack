"use client";

/*
 * The text of a PDF, read in the browser with pdf.js: the file never leaves the device. Used for
 * the precompilato, which is full of health data. Rows are rebuilt from the position of each
 * piece of text, so a line of the form ("E8 29 450,00") comes back as one string.
 */

export async function pdfLines(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.min.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const lines: string[] = [];
  try {
    for (let p = 1; p <= Math.min(doc.numPages, 40); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const rows = new Map<number, { x: number; s: string }[]>();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        // Pieces within 2 points vertically belong to the same row.
        const y = Math.round(item.transform[5] / 2) * 2;
        const row = rows.get(y) ?? [];
        row.push({ x: item.transform[4], s: item.str });
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
  } finally {
    await doc.destroy();
  }
  return lines;
}
