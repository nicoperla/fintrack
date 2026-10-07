import { describe, expect, it } from "vitest";
import {
  buildFamilyFile,
  isShareToken,
  readNotes,
  secretWarnings,
  shareState,
  type FamilyFileInput,
} from "./family-file";
import { hashShareToken, newShareToken } from "./family-file-tokens";

const input: FamilyFileInput = {
  spaceName: "Casa Rossi",
  currency: "EUR",
  today: "2026-10-07",
  people: ["Anna", "Marco"],
  accounts: [
    { name: "Conto corrente", type: "CHECKING", currency: "EUR", balance: 2400, archived: false },
    { name: "Vecchio conto Poste", type: "SAVINGS", currency: "EUR", balance: 310, archived: true },
    { name: "ETF", type: "INVESTMENT", currency: "EUR", balance: 5000, archived: false },
  ],
  investments: [{ name: "ETF", currency: "EUR", value: 5450, valuedAt: "2026-09-30" }],
  debts: [{ name: "Mutuo", balance: 98000, interestRate: 3.1, minimumPayment: 620 }],
  recurring: [{ name: "Netflix", frequency: "monthly", amount: 15.49, nextDate: "2026-11-03" }],
  notes: {
    documenti: "Contratti nel cassetto dello studio.",
    contatti: "",
    polizze: "  ",
    istruzioni: "Disdire la palestra.",
  },
};

describe("buildFamilyFile", () => {
  it("says where things are, not how much, unless asked", () => {
    const file = buildFamilyFile(input, { showAmounts: false });
    expect(file.accounts).toEqual([
      {
        name: "Conto corrente",
        kind: "Conto corrente",
        currency: "EUR",
        balance: null,
        archived: false,
      },
      {
        name: "Vecchio conto Poste",
        kind: "Risparmi",
        currency: "EUR",
        balance: null,
        archived: true,
      },
    ]);
    expect(file.investments).toEqual([
      { name: "ETF", currency: "EUR", value: null, valuedAt: "2026-09-30" },
    ]);
    expect(file.debts).toEqual([
      { name: "Mutuo", balance: null, interestRate: 3.1, minimumPayment: null },
    ]);
    expect(file.recurring).toEqual([{ name: "Netflix", frequency: "ogni mese", amount: null }]);
    expect(JSON.stringify(file)).not.toMatch(/2400|98000|5450|15\.49/);
  });

  it("shows the amounts when the user chooses to", () => {
    const file = buildFamilyFile(input, { showAmounts: true });
    expect(file.accounts[0].balance).toBe(2400);
    expect(file.debts[0]).toMatchObject({ balance: 98000, minimumPayment: 620 });
    expect(file.recurring[0].amount).toBe(15.49);
  });

  it("keeps only the notes that were written", () => {
    expect(buildFamilyFile(input, { showAmounts: false }).notes).toEqual([
      { title: "Dove sono i documenti", text: "Contratti nel cassetto dello studio." },
      { title: "Cose da sapere", text: "Disdire la palestra." },
    ]);
  });
});

describe("notes", () => {
  it("reads what was stored, dropping anything else", () => {
    expect(readNotes({ documenti: "Cassetto", extra: "x", contatti: 3 })).toEqual({
      documenti: "Cassetto",
      contatti: "",
      polizze: "",
      istruzioni: "",
    });
    expect(readNotes(null).documenti).toBe("");
  });

  it("warns about passwords and card numbers, not about where they're kept", () => {
    expect(secretWarnings("La password: Gatto123!")).toHaveLength(1);
    expect(secretWarnings("PIN=1234")).toHaveLength(1);
    expect(secretWarnings("carta 4111 1111 1111 1111 nel portafoglio")).toHaveLength(1);
    expect(secretWarnings("Il PIN è nella busta in cassaforte")).toEqual([]);
    expect(secretWarnings("Commercialista: dott. Bianchi, 02 1234 5678")).toEqual([]);
  });
});

describe("share links", () => {
  it("makes tokens the links accept, and stores only their hash", () => {
    const { token, hash } = newShareToken();
    expect(isShareToken(token)).toBe(true);
    expect(hash).toBe(hashShareToken(token));
    expect(hash).not.toContain(token);
    expect(newShareToken().token).not.toBe(token);
    expect(isShareToken("abc")).toBe(false);
    expect(isShareToken(`${token}x`)).toBe(false);
  });

  it("knows when a link stops working", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    const future = new Date("2026-10-14T12:00:00Z");
    expect(shareState({ expiresAt: future, revokedAt: null }, now)).toBe("active");
    expect(shareState({ expiresAt: now, revokedAt: null }, now)).toBe("expired");
    expect(shareState({ expiresAt: future, revokedAt: now }, now)).toBe("revoked");
  });
});
