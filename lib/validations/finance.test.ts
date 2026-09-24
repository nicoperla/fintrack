import { describe, expect, it } from "vitest";
import { transactionFiltersSchema, transactionSchema } from "./finance";

const base = {
  type: "EXPENSE",
  amount: "12,50",
  date: "2026-09-24",
  description: "Spesa",
  accountId: "acc_1",
  transferAccountId: "",
  categoryId: "cat_1",
  notes: "",
  tags: "",
};

describe("transactionSchema", () => {
  it("normalizes a valid expense", () => {
    const result = transactionSchema.parse(base);
    expect(result.amount).toBe("12.50");
    expect(result.date.toISOString()).toBe("2026-09-24T00:00:00.000Z");
    expect(result.transferAccountId).toBeNull();
    expect(result.notes).toBeNull();
  });

  it("rejects zero and negative amounts", () => {
    expect(transactionSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, amount: "-5" }).success).toBe(false);
  });

  it("rejects impossible dates", () => {
    expect(transactionSchema.safeParse({ ...base, date: "2026-13-40" }).success).toBe(false);
  });

  it("requires a description for income and expenses", () => {
    const result = transactionSchema.safeParse({ ...base, description: "  " });
    expect(result.success).toBe(false);
  });

  it("cleans up tags", () => {
    const result = transactionSchema.parse({ ...base, tags: " Vacanza, #lavoro,vacanza,, " });
    expect(result.tags).toEqual(["vacanza", "lavoro"]);
  });

  describe("transfers", () => {
    const transfer = { ...base, type: "TRANSFER", description: "", transferAccountId: "acc_2" };

    it("drops the category and defaults the description", () => {
      const result = transactionSchema.parse(transfer);
      expect(result.categoryId).toBeNull();
      expect(result.description).toBe("Trasferimento");
      expect(result.transferAccountId).toBe("acc_2");
    });

    it("requires a destination account", () => {
      const result = transactionSchema.safeParse({ ...transfer, transferAccountId: "" });
      expect(result.success).toBe(false);
    });

    it("rejects transfers to the same account", () => {
      const result = transactionSchema.safeParse({ ...transfer, transferAccountId: "acc_1" });
      expect(result.success).toBe(false);
    });
  });
});

describe("transactionFiltersSchema", () => {
  it("ignores malformed values instead of failing", () => {
    const result = transactionFiltersSchema.parse({
      q: "  ",
      type: "BOGUS",
      from: "not-a-date",
      min: "abc",
      page: "-3",
      accountId: ["a", "b"],
    });
    expect(result).toEqual({
      q: undefined,
      type: undefined,
      accountId: undefined,
      categoryId: undefined,
      from: undefined,
      to: undefined,
      min: undefined,
      max: undefined,
      page: undefined,
    });
  });

  it("parses valid filters", () => {
    const result = transactionFiltersSchema.parse({
      q: "netflix",
      type: "EXPENSE",
      min: "10,5",
      page: "2",
    });
    expect(result.q).toBe("netflix");
    expect(result.type).toBe("EXPENSE");
    expect(result.min).toBe("10.50");
    expect(result.page).toBe(2);
  });
});
