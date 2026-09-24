import { describe, expect, it } from "vitest";
import {
  buildImportRows,
  detectDateFormat,
  guessMapping,
  parseDate,
  parseSignedCsvAmount,
  type ColumnMapping,
} from "./csv";

describe("parseDate", () => {
  it.each([
    ["24/09/2026", "DD/MM/YYYY", "2026-09-24"],
    ["4/9/2026", "DD/MM/YYYY", "2026-09-04"],
    ["2026-09-24", "YYYY-MM-DD", "2026-09-24"],
    ["24-09-2026", "DD-MM-YYYY", "2026-09-24"],
    ["24.09.2026", "DD.MM.YYYY", "2026-09-24"],
    ["24/09/26", "DD/MM/YY", "2026-09-24"],
    ["24/09/2026 14:30", "DD/MM/YYYY", "2026-09-24"],
  ] as const)("parses %s (%s)", (input, format, expected) => {
    expect(parseDate(input, format)).toBe(expected);
  });

  it("rejects impossible dates", () => {
    expect(parseDate("31/02/2026", "DD/MM/YYYY")).toBeNull();
    expect(parseDate("2026-13-01", "YYYY-MM-DD")).toBeNull();
  });
});

describe("detectDateFormat", () => {
  it("picks the format matching every sample", () => {
    expect(detectDateFormat(["01/09/2026", "24/09/2026"])).toBe("DD/MM/YYYY");
    expect(detectDateFormat(["2026-09-01"])).toBe("YYYY-MM-DD");
    expect(detectDateFormat(["abc"])).toBeNull();
  });
});

describe("parseSignedCsvAmount", () => {
  it.each([
    ["1.234,56", "1234.56"],
    ["-1.234,56", "-1234.56"],
    ["1,234.56", "1234.56"],
    ["-12,50", "-12.50"],
    ["12,50-", "-12.50"],
    ["(12,50)", "-12.50"],
    ["+12,50", "12.50"],
    ["€ 12,50", "12.50"],
    ["12,50 EUR", "12.50"],
    ["1.500", "1500.00"],
    ["12.5", "12.50"],
    ["0,00", "0.00"],
  ])("parses %j as %s", (input, expected) => {
    expect(parseSignedCsvAmount(input)).toBe(expected);
  });

  it.each(["", "abc", "12,5,5", "--"])("rejects %j", (input) => {
    expect(parseSignedCsvAmount(input)).toBeNull();
  });
});

describe("guessMapping", () => {
  it("recognizes a typical Italian bank export with a signed amount", () => {
    const headers = ["Data contabile", "Data valuta", "Descrizione", "Importo"];
    const mapping = guessMapping(headers, [["01/09/2026", "02/09/2026", "Esselunga", "-45,20"]]);
    expect(mapping).toMatchObject({
      dateColumn: 0,
      descriptionColumn: 2,
      amountMode: "single",
      amountColumn: 3,
      dateFormat: "DD/MM/YYYY",
    });
  });

  it("recognizes separate debit/credit columns", () => {
    const headers = ["Data operazione", "Causale", "Dare", "Avere"];
    const mapping = guessMapping(headers, [["2026-09-01", "Stipendio", "", "2.350,00"]]);
    expect(mapping).toMatchObject({
      dateColumn: 0,
      descriptionColumn: 1,
      amountMode: "split",
      debitColumn: 2,
      creditColumn: 3,
      dateFormat: "YYYY-MM-DD",
    });
  });
});

describe("buildImportRows", () => {
  const single: ColumnMapping = {
    dateColumn: 0,
    descriptionColumn: 1,
    dateFormat: "DD/MM/YYYY",
    amountMode: "single",
    amountColumn: 2,
    debitColumn: 0,
    creditColumn: 0,
    invertSign: false,
  };

  it("derives type and absolute amount from the sign", () => {
    const { rows, errors } = buildImportRows(
      [
        ["01/09/2026", "  Esselunga   Milano ", "-45,20"],
        ["27/09/2026", "Stipendio", "2.350,00"],
      ],
      single,
    );
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        line: 2,
        date: "2026-09-01",
        description: "Esselunga Milano",
        amount: "45.20",
        type: "EXPENSE",
      },
      { line: 3, date: "2026-09-27", description: "Stipendio", amount: "2350.00", type: "INCOME" },
    ]);
  });

  it("inverts the sign when expenses are positive in the file", () => {
    const { rows } = buildImportRows([["01/09/2026", "Netflix", "15,49"]], {
      ...single,
      invertSign: true,
    });
    expect(rows[0]).toMatchObject({ type: "EXPENSE", amount: "15.49" });
  });

  it("combines debit and credit columns", () => {
    const { rows } = buildImportRows(
      [
        ["01/09/2026", "Affitto", "750,00", ""],
        ["27/09/2026", "Stipendio", "", "2.350,00"],
      ],
      { ...single, amountMode: "split", debitColumn: 2, creditColumn: 3 },
    );
    expect(rows.map((r) => [r.type, r.amount])).toEqual([
      ["EXPENSE", "750.00"],
      ["INCOME", "2350.00"],
    ]);
  });

  it("reports bad rows with their file line and skips blank lines", () => {
    const { rows, errors } = buildImportRows(
      [
        ["31/02/2026", "Data sbagliata", "-1,00"],
        ["", "", ""],
        ["01/09/2026", "Senza importo", "abc"],
        ["02/09/2026", "Zero", "0,00"],
        ["03/09/2026", "", "-5,00"],
      ],
      single,
    );
    expect(errors.map((e) => e.line)).toEqual([2, 4, 5]);
    expect(rows).toEqual([
      {
        line: 6,
        date: "2026-09-03",
        description: "Movimento importato",
        amount: "5.00",
        type: "EXPENSE",
      },
    ]);
  });
});
