import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeBalances } from "./balances";

const d = (v: string | number) => new Prisma.Decimal(v);

describe("computeBalances", () => {
  const accounts = [
    { id: "checking", initialBalance: d("1000.00") },
    { id: "card", initialBalance: d("-50.00") },
    { id: "savings", initialBalance: d(0) },
  ];

  it("returns the initial balance for accounts without movements", () => {
    const balances = computeBalances(accounts, [], []);
    expect(balances.get("checking")?.toFixed(2)).toBe("1000.00");
    expect(balances.get("card")?.toFixed(2)).toBe("-50.00");
  });

  it("adds income and subtracts expenses", () => {
    const balances = computeBalances(
      accounts,
      [
        { accountId: "checking", type: "INCOME", amount: d("2350.00") },
        { accountId: "checking", type: "EXPENSE", amount: d("1200.10") },
      ],
      [],
    );
    expect(balances.get("checking")?.toFixed(2)).toBe("2149.90");
  });

  it("moves money on transfers without changing the total", () => {
    const balances = computeBalances(
      accounts,
      [{ accountId: "checking", type: "TRANSFER", amount: d("300.00") }],
      [{ transferAccountId: "savings", amount: d("300.00") }],
    );
    expect(balances.get("checking")?.toFixed(2)).toBe("700.00");
    expect(balances.get("savings")?.toFixed(2)).toBe("300.00");
    const total = Array.from(balances.values()).reduce((a, b) => a.plus(b), d(0));
    expect(total.toFixed(2)).toBe("950.00");
  });

  it("is exact with decimal amounts that break floating point", () => {
    const balances = computeBalances(
      [{ id: "a", initialBalance: d("0.10") }],
      [{ accountId: "a", type: "INCOME", amount: d("0.20") }],
      [],
    );
    expect(balances.get("a")?.toFixed(2)).toBe("0.30");
    expect(balances.get("a")?.equals(d("0.3"))).toBe(true);
  });

  it("ignores sums for unknown accounts and null aggregates", () => {
    const balances = computeBalances(
      accounts,
      [
        { accountId: "ghost", type: "INCOME", amount: d(999) },
        { accountId: "checking", type: "EXPENSE", amount: null },
      ],
      [
        { transferAccountId: null, amount: d(5) },
        { transferAccountId: "ghost", amount: d(5) },
      ],
    );
    expect(balances.get("checking")?.toFixed(2)).toBe("1000.00");
    expect(balances.has("ghost")).toBe(false);
  });
});
