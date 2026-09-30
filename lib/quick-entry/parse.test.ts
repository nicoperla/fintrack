import { describe, expect, it } from "vitest";
import { parseQuickEntry, type QuickEntryContext } from "./parse";

const ctx: QuickEntryContext = {
  today: "2026-09-24", // Thursday
  categories: [
    { id: "carburante", name: "Carburante", type: "EXPENSE" },
    { id: "trasporti", name: "Trasporti", type: "EXPENSE" },
    { id: "super", name: "Supermercato", type: "EXPENSE" },
    { id: "bar", name: "Bar e caffè", type: "EXPENSE" },
    { id: "risto", name: "Ristoranti", type: "EXPENSE" },
    { id: "salute", name: "Salute", type: "EXPENSE" },
    { id: "stipendio", name: "Stipendio", type: "INCOME" },
  ],
  accounts: [
    { id: "cc", name: "Conto corrente", type: "CHECKING" },
    { id: "cash", name: "Contanti", type: "CASH" },
    { id: "visa", name: "Carta di credito", type: "CARD" },
  ],
  defaultAccountId: "cc",
  hints: [{ description: "Sushi Zen", categoryId: "risto" }],
};

describe("parseQuickEntry", () => {
  it("parses the canonical example", () => {
    expect(parseQuickEntry("35 benzina ieri", ctx)).toEqual({
      amount: "35.00",
      type: "EXPENSE",
      date: "2026-09-23",
      description: "Benzina",
      categoryId: "carburante",
      accountId: "cc",
      tags: [],
    });
  });

  it.each([
    ["caffè 1,50", "1.50", "bar", "Caffè"],
    ["€12 farmacia", "12.00", "salute", "Farmacia"],
    ["pizza 24€", "24.00", "risto", "Pizza"],
    ["spesa esselunga 1.234,56 euro", "1234.56", "super", "Spesa esselunga"],
  ])("parses %j", (input, amount, categoryId, description) => {
    const result = parseQuickEntry(input, ctx);
    expect(result).toMatchObject({ amount, categoryId, description, date: "2026-09-24" });
  });

  it("detects income from keywords or a plus sign", () => {
    expect(parseQuickEntry("stipendio 2350", ctx)).toMatchObject({
      type: "INCOME",
      categoryId: "stipendio",
      amount: "2350.00",
    });
    expect(parseQuickEntry("+50 vendita bici", ctx)).toMatchObject({
      type: "INCOME",
      categoryId: null,
    });
  });

  it("understands relative and explicit dates", () => {
    expect(parseQuickEntry("10 bar altro ieri", ctx).date).toBe("2026-09-22");
    expect(parseQuickEntry("10 bar l'altro ieri", ctx).date).toBe("2026-09-22");
    expect(parseQuickEntry("10 bar altroieri", ctx).date).toBe("2026-09-22");
    expect(parseQuickEntry("10 bar 3 giorni fa", ctx).date).toBe("2026-09-21");
    expect(parseQuickEntry("10 bar lunedì", ctx).date).toBe("2026-09-21");
    expect(parseQuickEntry("10 bar 12/09", ctx).date).toBe("2026-09-12");
    expect(parseQuickEntry("10 bar 5 agosto", ctx).date).toBe("2026-08-05");
    expect(parseQuickEntry("5 agosto 10 bar", ctx)).toMatchObject({
      date: "2026-08-05",
      amount: "10.00",
    });
    expect(parseQuickEntry("12.05 caffè", ctx)).toMatchObject({
      date: "2026-09-24",
      amount: "12.05",
    });
    // A day later in the year means last year.
    expect(parseQuickEntry("10 regalo 25/12", ctx).date).toBe("2025-12-25");
  });

  it("picks the account by name or by type keyword", () => {
    expect(parseQuickEntry("5 caffè contanti", ctx).accountId).toBe("cash");
    expect(parseQuickEntry("40 cena con carta", ctx)).toMatchObject({
      accountId: "visa",
      description: "Cena",
    });
    expect(parseQuickEntry("40 cena carta di credito", ctx).accountId).toBe("visa");
  });

  it("uses learned descriptions and collects tags", () => {
    expect(parseQuickEntry("32 Sushi Zen #amici #venerdì", ctx)).toMatchObject({
      categoryId: "risto",
      description: "Sushi Zen",
      tags: ["amici", "venerdi"],
    });
  });

  it("leaves amount empty when there is none", () => {
    expect(parseQuickEntry("benzina ieri", ctx)).toMatchObject({
      amount: null,
      categoryId: "carburante",
    });
  });
});

describe("tobacco and dictated entries", () => {
  const withTobacco: QuickEntryContext = {
    ...ctx,
    categories: [
      ...ctx.categories,
      { id: "tabacchi", name: "Tabacchi", type: "EXPENSE" },
      { id: "sigarette", name: "Sigarette", type: "EXPENSE" },
      { id: "svapo", name: "Svapo e IQOS", type: "EXPENSE" },
      { id: "lotto", name: "Lotto e gratta e vinci", type: "EXPENSE" },
    ],
  };

  it.each([
    ["sigarette 6,20", "6.20", "sigarette"],
    ["5,50 marlboro", "5.50", "sigarette"],
    ["iqos 5", "5.00", "svapo"],
    ["gratta e vinci 10", "10.00", "lotto"],
    ["4 tabacchi", "4.00", "tabacchi"],
  ])("files %s under tobacco", (input, amount, categoryId) => {
    expect(parseQuickEntry(input, withTobacco)).toMatchObject({ amount, categoryId });
  });

  it("falls back to the parent category when there's no subcategory", () => {
    const parentOnly = {
      ...ctx,
      categories: [
        ...ctx.categories,
        { id: "tabacchi", name: "Tabacchi", type: "EXPENSE" as const },
      ],
    };
    expect(parseQuickEntry("sigarette 6", parentOnly).categoryId).toBe("tabacchi");
  });

  it("understands a dictated sentence", () => {
    expect(parseQuickEntry("Ieri ho speso 18 euro di pizza in contanti", ctx)).toEqual({
      amount: "18.00",
      type: "EXPENSE",
      date: "2026-09-23",
      description: "Pizza",
      categoryId: "risto",
      accountId: "cash",
      tags: [],
    });
  });

  it("reads euros and cents spoken as words", () => {
    expect(parseQuickEntry("ho pagato 12 euro e 50 il pranzo", ctx)).toMatchObject({
      amount: "12.50",
      description: "Pranzo",
      categoryId: "risto",
    });
    expect(parseQuickEntry("caffè 1 € e 5", ctx).amount).toBe("1.50");
  });
});
