import { describe, expect, it } from "vitest";
import { computeSplit, settleUp, splitShares } from "./split";

const anna = { userId: "anna", name: "Anna", income: 3000 };
const luca = { userId: "luca", name: "Luca", income: 1000 };

describe("splitShares", () => {
  it("splits equally by default", () => {
    const { shares } = splitShares([anna, luca], "EQUAL");
    expect(shares.get("anna")).toBe(0.5);
  });

  it("splits in proportion to income", () => {
    const { shares, mode } = splitShares([anna, luca], "INCOME");
    expect(mode).toBe("INCOME");
    expect(shares.get("anna")).toBe(0.75);
    expect(shares.get("luca")).toBe(0.25);
  });

  it("falls back to equal when an income is unknown", () => {
    const result = splitShares([anna, { ...luca, income: null }], "INCOME");
    expect(result.mode).toBe("EQUAL");
    expect(result.fallback).toBe(true);
  });
});

describe("computeSplit", () => {
  it("tells who owes whom with an equal split", () => {
    const result = computeSplit({
      members: [anna, luca],
      expenses: [
        { userId: "anna", amount: 700 },
        { userId: "luca", amount: 300 },
      ],
      settlements: [],
      mode: "EQUAL",
    });
    expect(result.total).toBe(1000);
    expect(result.members.find((m) => m.userId === "anna")!.balance).toBe(200);
    expect(result.transfers).toEqual([{ fromUserId: "luca", toUserId: "anna", amount: 200 }]);
  });

  it("uses income shares", () => {
    const result = computeSplit({
      members: [anna, luca],
      expenses: [
        { userId: "anna", amount: 500 },
        { userId: "luca", amount: 500 },
      ],
      settlements: [],
      mode: "INCOME",
    });
    // Luca should cover a quarter (250) and paid 500: Anna owes him 250.
    expect(result.transfers).toEqual([{ fromUserId: "anna", toUserId: "luca", amount: 250 }]);
  });

  it("counts settlements already paid", () => {
    const result = computeSplit({
      members: [anna, luca],
      expenses: [{ userId: "anna", amount: 400 }],
      settlements: [{ fromUserId: "luca", toUserId: "anna", amount: 150 }],
      mode: "EQUAL",
    });
    expect(result.transfers).toEqual([{ fromUserId: "luca", toUserId: "anna", amount: 50 }]);
  });

  it("is even when everything is settled", () => {
    const result = computeSplit({
      members: [anna, luca],
      expenses: [{ userId: "anna", amount: 100 }],
      settlements: [{ fromUserId: "luca", toUserId: "anna", amount: 50 }],
      mode: "EQUAL",
    });
    expect(result.transfers).toEqual([]);
  });

  it("leaves out expenses of people who left", () => {
    const result = computeSplit({
      members: [anna, luca],
      expenses: [
        { userId: null, amount: 80 },
        { userId: "ex", amount: 20 },
      ],
      settlements: [],
      mode: "EQUAL",
    });
    expect(result.total).toBe(0);
    expect(result.unattributed).toBe(100);
  });
});

describe("settleUp", () => {
  it("needs at most n − 1 transfers among three people", () => {
    const transfers = settleUp([
      { userId: "a", balance: 90 },
      { userId: "b", balance: -60 },
      { userId: "c", balance: -30 },
    ]);
    expect(transfers).toEqual([
      { fromUserId: "b", toUserId: "a", amount: 60 },
      { fromUserId: "c", toUserId: "a", amount: 30 },
    ]);
  });
});

describe("rounding", () => {
  it("shows the same amount to the one who owes and the one who's owed", () => {
    const result = computeSplit({
      members: [anna, luca],
      expenses: [
        { userId: "anna", amount: 1645.78 },
        { userId: "luca", amount: 442.57 },
      ],
      settlements: [],
      mode: "EQUAL",
    });
    const [a, l] = result.members;
    expect(a.balance).toBe(-l.balance);
    expect(result.transfers[0].amount).toBe(a.balance);
  });
});
