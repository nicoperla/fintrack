import { describe, expect, it } from "vitest";
import {
  cancellationLetter,
  findBankFees,
  findDuplicates,
  findPriceIncreases,
  findRenewals,
  type FoundTx,
} from "./found-money";
import type { Recurring } from "./recurring";

let id = 0;
const tx = (
  date: string,
  description: string,
  amount: number,
  extra: Partial<FoundTx> = {},
): FoundTx => ({
  id: String(++id).padStart(3, "0"),
  date,
  description,
  amount,
  accountId: "card",
  account: "Carta",
  category: null,
  ...extra,
});

describe("findDuplicates", () => {
  it("flags the second identical charge on the same day", () => {
    const dupes = findDuplicates(
      [tx("2026-09-10", "ZALANDO SE", 59.9), tx("2026-09-10", "Zalando SE", 59.9)],
      new Set(),
    );
    expect(dupes).toHaveLength(1);
    expect(dupes[0].amount).toBe(59.9);
  });

  it("ignores small repeated purchases, other accounts and other days", () => {
    expect(
      findDuplicates(
        [
          tx("2026-09-10", "Bar Centrale", 1.3),
          tx("2026-09-10", "Bar Centrale", 1.3),
          tx("2026-09-10", "Esselunga", 40, { accountId: "cash" }),
          tx("2026-09-10", "Esselunga", 40),
          tx("2026-09-01", "Amazon", 25),
          tx("2026-09-05", "Amazon", 25),
        ],
        new Set(),
      ),
    ).toEqual([]);
  });

  it("forgets duplicates the user marked as fine", () => {
    const a = tx("2026-09-10", "Zalando", 59.9);
    const b = tx("2026-09-11", "Zalando", 59.9);
    expect(findDuplicates([a, b], new Set([`dup:${b.id}`]))).toEqual([]);
  });
});

const recurring = (over: Partial<Recurring>): Recurring => ({
  key: "EXPENSE|netflix",
  name: "Netflix",
  type: "EXPENSE",
  categoryId: null,
  frequency: "monthly",
  occurrences: 4,
  averageAmount: 15.49,
  lastAmount: 15.49,
  lastDate: "2026-09-03",
  nextDate: "2026-10-03",
  variableAmount: false,
  active: true,
  monthlyCost: 15.49,
  priceChange: null,
  ...over,
});

describe("subscriptions", () => {
  it("prices a monthly increase over a year", () => {
    const [up] = findPriceIncreases(
      [recurring({ priceChange: { from: 13.99, to: 15.49, pct: 10.7 } })],
      new Set(),
    );
    expect(up.yearly).toBeCloseTo(18, 0);
  });

  it("warns about yearly renewals due within a month", () => {
    const yearly = recurring({
      key: "EXPENSE|prime",
      name: "Amazon Prime",
      frequency: "yearly",
      averageAmount: 49.9,
    });
    expect(
      findRenewals([{ ...yearly, nextDate: "2026-10-11" }], "2026-10-01", new Set()),
    ).toMatchObject([{ name: "Amazon Prime", daysLeft: 10 }]);
    expect(findRenewals([{ ...yearly, nextDate: "2026-11-20" }], "2026-10-01", new Set())).toEqual(
      [],
    );
    expect(findRenewals([recurring({})], "2026-10-01", new Set())).toEqual([]);
  });
});

describe("findBankFees", () => {
  const fees = [
    tx("2026-07-05", "Canone conto corrente", 7.9),
    tx("2026-08-05", "Canone conto corrente", 7.9),
    tx("2026-09-05", "Canone conto corrente", 7.9),
  ];

  it("annualizes the fees of the months tracked", () => {
    const result = findBankFees(fees, "2026-09-28", "2026-07-01", new Set())!;
    expect(result.count).toBe(3);
    expect(result.yearly).toBeCloseTo((23.7 * 365) / 90, 1);
  });

  it("stays quiet about trivial fees", () => {
    expect(findBankFees([fees[0]], "2026-09-28", "2025-09-28", new Set())).toBeNull();
  });
});

describe("cancellationLetter", () => {
  it("names the service and the sender", () => {
    const letter = cancellationLetter({
      service: "Netflix",
      fullName: "Anna Rossi",
      today: "2026-10-01",
    });
    expect(letter.subject).toBe("Disdetta abbonamento Netflix");
    expect(letter.body).toContain("io sottoscritto/a Anna Rossi");
    expect(letter.body).toContain("1 ottobre 2026");
  });
});
