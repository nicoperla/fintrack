import { describe, expect, it } from "vitest";
import { parsePrecompiled } from "./precompiled";
import { accountFigures, iseeCalendar } from "./isee";
import { EMPTY_BONUS_ANSWERS, findBonuses } from "./bonuses";
import { defaultRate, instalmentsFor } from "./home-bonus";
import { parseLetterReply } from "./letter";

describe("reading the precompilato", () => {
  it("reads the quadro E lines with their codes", () => {
    const reading = parsePrecompiled([
      "MODELLO 730/2027 QUADRO E",
      "E1 Spese sanitarie 1 2 1.234,50",
      "E7 Interessi mutuo 57 2.400,00",
      "E8 29 450,00",
      "E9 16 210,00",
      "E10 99 100,00",
      "E23 1.200,00",
      "E27 800,00",
      "E71 4 365 100",
      "Pagina 3 di 8",
    ]);
    expect(reading.totals).toEqual({
      sanitarie: 1234.5,
      mutuo: 2400,
      veterinarie: 450,
      sport: 210,
      colf: 1200,
      previdenza: 800,
    });
    expect(reading.rent).toBe(true);
  });

  it("reads whole euros too, but never takes a code or a column for an amount", () => {
    const reading = parsePrecompiled(["E8 12 800", "E9 33", "E1 Spese sanitarie 1 2"]);
    expect(reading.totals).toEqual({ istruzione: 800 });
    expect(reading.rent).toBe(false);
  });
});

describe("ISEE", () => {
  const accounts = [
    {
      id: "c",
      name: "Conto",
      type: "CHECKING" as const,
      currency: "EUR",
      initialBalance: 1000,
      startsOn: "2025-01-01",
    },
    {
      id: "s",
      name: "Risparmi",
      type: "SAVINGS" as const,
      currency: "EUR",
      initialBalance: 500,
      startsOn: "2025-12-01",
    },
    {
      id: "x",
      name: "Contanti",
      type: "CASH" as const,
      currency: "EUR",
      initialBalance: 50,
      startsOn: "2025-01-01",
    },
  ];

  it("works out the 31 December balance and the average daily balance", () => {
    const figures = accountFigures(
      accounts,
      [
        {
          date: "2025-07-01",
          type: "INCOME",
          accountId: "c",
          transferAccountId: null,
          amount: 365,
          transferAmount: null,
        },
        {
          date: "2025-12-31",
          type: "TRANSFER",
          accountId: "c",
          transferAccountId: "s",
          amount: 200,
          transferAmount: null,
        },
      ],
      2025,
    );
    const checking = figures.find((f) => f.id === "c")!;
    // 181 days at 1.000, 183 at 1.365, the last one at 1.165.
    expect(checking.end).toBe(1165);
    expect(checking.average).toBe(1183.45);
    const savings = figures.find((f) => f.id === "s")!;
    expect(savings.end).toBe(700);
    expect(savings.average).toBe(43.01); // 30 days at 500, one at 700, over 365
    expect(figures.some((f) => f.id === "x")).toBe(false);
  });

  it("knows the dates of the ISEE year", () => {
    expect(iseeCalendar(2027)).toMatchObject({
      assegnoUnicoBy: "2027-02-28",
      arrearsBy: "2027-06-30",
      expires: "2027-12-31",
    });
    expect(iseeCalendar(2028).assegnoUnicoBy).toBe("2028-02-29");
  });
});

describe("bonuses", () => {
  it("puts first what seems due, and says when the ISEE decides", () => {
    const results = findBonuses({ ...EMPTY_BONUS_ANSWERS, childrenUnder21: 1, childUnder3: true });
    const match = Object.fromEntries(results.map((r) => [r.bonus.key, r.match]));
    expect(match["assegno-unico"]).toBe("yes");
    expect(match.nido).toBe("yes");
    expect(match.psicologo).toBe("isee");
    expect(match["carta-cultura"]).toBe("no");
    expect(results[0].match).toBe("yes");
  });

  it("uses the ISEE when it's known", () => {
    const low = findBonuses({ ...EMPTY_BONUS_ANSWERS, isee: 9000 });
    expect(low.find((r) => r.bonus.key === "bonus-sociale")?.match).toBe("yes");
    const high = findBonuses({ ...EMPTY_BONUS_ANSWERS, isee: 60_000 });
    expect(high.find((r) => r.bonus.key === "psicologo")?.match).toBe("no");
  });
});

describe("home bonuses", () => {
  const bonuses = [
    {
      id: "a",
      kind: "ristrutturazione" as const,
      year: 2024,
      amount: 20_000,
      rate: 50,
      label: "Bagno",
    },
    { id: "b", kind: "mobili" as const, year: 2025, amount: 8_000, rate: 50, label: "" },
  ];

  it("splits each bonus in ten yearly instalments", () => {
    const list = instalmentsFor(bonuses, 2026);
    expect(list.map((i) => [i.bonus.id, i.number, i.amount])).toEqual([
      ["a", 3, 1000],
      ["b", 2, 250], // furniture counts up to 5.000 €
    ]);
    expect(instalmentsFor(bonuses, 2034).map((i) => i.bonus.id)).toEqual(["b"]);
    expect(instalmentsFor(bonuses, 2023)).toEqual([]);
  });

  it("suggests the usual rate", () => {
    expect(defaultRate("ristrutturazione", 2026, true)).toBe(50);
    expect(defaultRate("ristrutturazione", 2026, false)).toBe(36);
    expect(defaultRate("energetico", 2027, true)).toBe(36);
    expect(defaultRate("mobili", 2027, false)).toBe(50);
  });
});

describe("letter explanations", () => {
  it("reads the AI's JSON even inside a code fence, and fills the gaps", () => {
    const parsed = parseLetterReply(
      '```json\n{"readable":true,"sender":"INPS","summary":"Ti chiede un documento.","steps":["Rispondi"],"urgency":"alta","deadline":"31/12/2026"}\n```',
    );
    expect(parsed).toMatchObject({
      readable: true,
      sender: "INPS",
      urgency: "alta",
      deadline: null,
      documents: [],
      amount: null,
    });
  });

  it("refuses anything that isn't an explanation", () => {
    expect(parseLetterReply("Non posso aiutarti")).toBeNull();
    expect(parseLetterReply('{"sender": 3}')).toBeNull();
  });
});
