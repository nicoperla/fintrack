import { describe, expect, it } from "vitest";
import { detectRecurring, normalizeDescription, type RecurringInputTx } from "./recurring";

const tx = (
  date: string,
  amount: number,
  description: string,
  type: "INCOME" | "EXPENSE" = "EXPENSE",
): RecurringInputTx => ({
  date,
  amount,
  description,
  type,
  categoryId: "cat",
});

describe("normalizeDescription", () => {
  it("strips bank noise, digits and accents", () => {
    expect(normalizeDescription("PAGAMENTO POS NETFLIX.COM 12/09")).toBe("netflix com");
    expect(normalizeDescription("Caffè   Roma")).toBe("caffe roma");
    expect(normalizeDescription("1234")).toBe("");
  });
});

describe("detectRecurring", () => {
  const today = "2026-09-24";

  it("detects a monthly subscription and its price increase", () => {
    const [netflix] = detectRecurring(
      [
        tx("2026-06-03", 13.99, "Netflix"),
        tx("2026-07-03", 13.99, "Netflix"),
        tx("2026-08-03", 13.99, "Netflix"),
        tx("2026-09-03", 15.49, "Netflix"),
      ],
      today,
    );
    expect(netflix).toMatchObject({
      name: "Netflix",
      frequency: "monthly",
      occurrences: 4,
      averageAmount: 15.49,
      nextDate: "2026-10-03",
      active: true,
      variableAmount: false,
    });
    expect(netflix.priceChange?.from).toBe(13.99);
    expect(netflix.priceChange?.pct).toBeCloseTo(10.72, 1);
  });

  it("ignores irregular purchases like groceries", () => {
    const groceries = ["2026-09-01", "2026-09-04", "2026-09-09", "2026-09-12", "2026-09-17"].map(
      (d, i) => tx(d, 30 + i * 17, "Esselunga"),
    );
    expect(detectRecurring(groceries, today)).toEqual([]);
  });

  it("accepts bills with a variable amount", () => {
    const [bill] = detectRecurring(
      [
        tx("2026-06-10", 62, "Bolletta luce"),
        tx("2026-07-10", 81, "Bolletta luce"),
        tx("2026-08-10", 70, "Bolletta luce"),
      ],
      today,
    );
    expect(bill).toMatchObject({ variableAmount: true, priceChange: null, frequency: "monthly" });
    expect(bill.averageAmount).toBeCloseTo(71, 0);
  });

  it("rejects series whose amounts vary too much", () => {
    const series = [
      tx("2026-06-10", 10, "Varie"),
      tx("2026-07-10", 90, "Varie"),
      tx("2026-08-10", 30, "Varie"),
    ];
    expect(detectRecurring(series, today)).toEqual([]);
  });

  it("detects weekly series, income, and marks stopped ones as inactive", () => {
    const results = detectRecurring(
      [
        tx("2026-06-01", 10, "Corso yoga"),
        tx("2026-06-08", 10, "Corso yoga"),
        tx("2026-06-15", 10, "Corso yoga"),
        tx("2026-06-22", 10, "Corso yoga"),
        tx("2026-07-27", 2350, "Stipendio", "INCOME"),
        tx("2026-08-27", 2350, "Stipendio", "INCOME"),
        tx("2026-09-27", 2350, "Stipendio", "INCOME"),
      ],
      "2026-09-28",
    );
    const yoga = results.find((r) => r.name === "Corso yoga");
    const salary = results.find((r) => r.name === "Stipendio");
    expect(yoga).toMatchObject({ frequency: "weekly", active: false });
    expect(yoga?.monthlyCost).toBeCloseTo(43.49, 1);
    expect(salary).toMatchObject({ type: "INCOME", frequency: "monthly", active: true });
  });

  it("needs at least three occurrences", () => {
    expect(
      detectRecurring([tx("2026-08-01", 9.99, "Iliad"), tx("2026-09-01", 9.99, "Iliad")], today),
    ).toEqual([]);
  });

  it("clamps the next date to the end of shorter months", () => {
    const [rent] = detectRecurring(
      [
        tx("2026-06-30", 750, "Affitto"),
        tx("2026-07-31", 750, "Affitto"),
        tx("2026-08-31", 750, "Affitto"),
      ],
      today,
    );
    expect(rent.nextDate).toBe("2026-09-30");
  });
});
