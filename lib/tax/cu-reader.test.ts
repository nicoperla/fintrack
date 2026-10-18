import { describe, expect, it } from "vitest";
import { parseAmountText, parseCu, type PdfItem } from "./cu-reader";

// The box numbers where they are on page 2 of the official CU 2026 form (points from the bottom).
const LABELS: PdfItem[] = [
  { str: "DATI FISCALI", x: 28, y: 760 },
  { str: "Redditi di lavoro dipendente e assimilati", x: 124, y: 755 },
  { str: "1", x: 122, y: 741 },
  { str: "2", x: 232, y: 741 },
  { str: "3", x: 342, y: 741 },
  { str: "4", x: 453, y: 741 },
  { str: "Numero di giorni", x: 256, y: 722 },
  { str: "5", x: 122, y: 699 },
  { str: "6", x: 230, y: 699 },
  { str: "7", x: 280, y: 699 },
  { str: "Ritenute Irpef", x: 145, y: 628 },
  { str: "21", x: 122, y: 622 },
  { str: "22", x: 209, y: 622 },
  { str: "26", x: 301, y: 622 },
];
const frontPage = { items: [{ str: "CERTIFICAZIONE UNICA 2026", x: 200, y: 800 }] };

describe("parseAmountText", () => {
  it("reads the ways payroll software writes amounts", () => {
    expect(parseAmountText("24.500,00")).toBe(24500);
    expect(parseAmountText("24500,00")).toBe(24500);
    expect(parseAmountText("24500.00")).toBe(24500);
    expect(parseAmountText("1.234")).toBe(1234);
    expect(parseAmountText("365")).toBe(365);
    expect(parseAmountText("€ 3.120,50")).toBe(3120.5);
    expect(parseAmountText("Redditi")).toBeNull();
  });
});

describe("parseCu", () => {
  it("reads the values written inside the boxes", () => {
    const reading = parseCu([
      frontPage,
      {
        items: [
          ...LABELS,
          { str: "24.500,00", x: 160, y: 731 },
          { str: "365", x: 240, y: 689 },
          { str: "4.120,30", x: 150, y: 612 },
          { str: "380,00", x: 230, y: 612 },
        ],
      },
    ]);
    expect(reading?.entries).toEqual([
      { kind: "employee", income: 24500, days: 365, withheld: 4120.3, fixedTerm: false },
    ]);
    expect(reading?.found.map((f) => f.box)).toEqual(["1", "6", "21"]);
  });

  it("knows a fixed-term contract and a pension", () => {
    const fixed = parseCu([
      { items: [...LABELS, { str: "9.800,00", x: 250, y: 733 }, { str: "180", x: 236, y: 690 }] },
    ]);
    expect(fixed?.entries[0]).toMatchObject({
      kind: "employee",
      income: 9800,
      days: 180,
      fixedTerm: true,
    });

    const pension = parseCu([
      {
        items: [
          ...LABELS,
          { str: "18.200,00", x: 370, y: 732 },
          { str: "365", x: 288, y: 690 },
          { str: "2.950,00", x: 140, y: 613 },
        ],
      },
    ]);
    expect(pension?.entries).toEqual([
      { kind: "pensioner", income: 18200, days: 365, withheld: 2950, fixedTerm: false },
    ]);
  });

  it("finds amounts written right after the box number, in the text", () => {
    // Values on the box's own row, as some software prints them.
    const reading = parseCu([
      {
        items: [
          ...LABELS,
          { str: "31.000,00", x: 128, y: 741 },
          { str: "365", x: 236, y: 699 },
          { str: "6.200,00", x: 132, y: 622 },
        ],
      },
    ]);
    expect(reading?.entries[0]).toMatchObject({ income: 31000, days: 365, withheld: 6200 });
  });

  it("falls back to the sequence when positions don't line up", () => {
    const reading = parseCu([
      {
        items: [
          ...LABELS.filter((l) => l.str !== "21" && l.str !== "22"),
          { str: "1 20.000,00", x: 40, y: 500 },
          { str: "21 3.000,00", x: 40, y: 480 },
        ],
      },
    ]);
    expect(reading?.entries[0]).toMatchObject({ income: 20000, withheld: 3000, days: 365 });
  });

  it("gives up on anything that isn't a CU", () => {
    expect(parseCu([frontPage])).toBeNull();
    expect(parseCu([{ items: LABELS }])).toBeNull();
  });
});
