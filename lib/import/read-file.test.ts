import { describe, expect, it } from "vitest";
import { detectHeaderRow, parseCsv } from "./read-file";

describe("parseCsv", () => {
  it("auto-detects the semicolon delimiter and keeps quoted separators", () => {
    const rows = parseCsv('Data;Descrizione;Importo\n01/09/2026;"Bar; Caffè";-1,50\n');
    expect(rows).toEqual([
      ["Data", "Descrizione", "Importo"],
      ["01/09/2026", "Bar; Caffè", "-1,50"],
    ]);
  });
});

describe("detectHeaderRow", () => {
  it("skips a bank preamble", () => {
    const rows = parseCsv(
      [
        "Estratto conto",
        "Intestatario;Mario Rossi",
        "Data operazione;Descrizione;Dare;Avere",
        "01/09/2026;Affitto;750,00;",
        "27/09/2026;Stipendio;;2.350,00",
        "28/09/2026;Esselunga;45,20;",
      ].join("\n"),
    );
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it("skips a preamble padded to the table width by Excel", () => {
    const rows = parseCsv(
      [
        "Estratto conto;;;;",
        "Intestatario;Mario Rossi;;;",
        "Data contabile;Data valuta;Descrizione;Accrediti;Addebiti",
        "03/09/2026;03/09/2026;Netflix;;15,49",
        "23/09/2026;23/09/2026;Rimborso;19,90;",
      ].join("\n"),
    );
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it("returns 0 for a plain table", () => {
    expect(detectHeaderRow(parseCsv("Data,Importo\n2026-09-01,-5\n2026-09-02,-7"))).toBe(0);
  });
});
