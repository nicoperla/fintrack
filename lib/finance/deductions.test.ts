import { describe, expect, it } from "vitest";
import { inferDeduction, summarizeDeductions, type DeductionInput } from "./deductions";

const infer = (category: string | null, description: string, parent: string | null = null) =>
  inferDeduction({ category, parent, description });

describe("inferDeduction", () => {
  it("recognizes medicines, which count even in cash", () => {
    expect(infer("Farmacia", "Farmacia Centrale", "Salute")).toMatchObject({
      type: "sanitarie",
      confidence: "sure",
      cashAllowed: true,
    });
  });

  it("recognizes private visits, which must be traceable", () => {
    expect(infer("Visite mediche", "Visita dermatologica", "Salute")).toMatchObject({
      type: "sanitarie",
      cashAllowed: false,
    });
    expect(infer(null, "Dentista dott. Rossi")?.type).toBe("sanitarie");
    expect(infer("Altro", "Ticket visita oculistica")?.cashAllowed).toBe(true);
  });

  it("tells the vet from pet food", () => {
    expect(infer("Veterinario", "Clinica Fido", "Animali")?.type).toBe("veterinarie");
    expect(infer("Cibo per animali", "Crocchette", "Animali")).toBeNull();
  });

  it("counts public transport passes, not single tickets", () => {
    expect(infer("Trasporto pubblico", "Abbonamento mensile ATM")?.type).toBe("trasporto");
    expect(infer("Trasporto pubblico", "Biglietto metro")).toBeNull();
  });

  it("asks to check what is only partly deductible", () => {
    expect(infer("Casa", "Rata mutuo")).toMatchObject({ type: "mutuo", confidence: "check" });
    expect(infer("Assicurazione casa e vita", "Polizza vita Generali")?.confidence).toBe("check");
    expect(infer("Salute", "Integratori", null)).toMatchObject({ confidence: "check" });
  });

  it("ignores everyday spending", () => {
    expect(infer("Supermercato", "Esselunga", "Spesa")).toBeNull();
  });
});

let id = 0;
const tx = (
  amount: number,
  category: string,
  description: string,
  extra: Partial<DeductionInput> = {},
): DeductionInput => ({
  id: String(++id),
  date: "2026-05-10",
  description,
  amount,
  account: "Carta",
  accountType: "CARD",
  memberId: "anna",
  category,
  parent: null,
  override: null,
  ...extra,
});

describe("summarizeDeductions", () => {
  it("applies the franchigia and leaves out cash where it isn't allowed", () => {
    const summary = summarizeDeductions(
      [
        tx(120, "Visite mediche", "Visita dermatologica"),
        tx(180, "Visite mediche", "Dentista"),
        tx(25, "Farmacia", "Farmacia", { accountType: "CASH", account: "Contanti" }),
        tx(90, "Visite mediche", "Visita oculistica", { accountType: "CASH", account: "Contanti" }),
      ],
      0,
    );
    const health = summary.byType.find((t) => t.type === "sanitarie")!;
    expect(health.eligible).toBe(325);
    expect(health.refund).toBe(37.22); // (325 - 129.11) × 19%
    expect(health.lostToCash).toBe(17.1); // the 90 € visit paid in cash
    expect(summary.lines.find((l) => l.amount === 90)?.status).toBe("cash");
  });

  it("caps veterinary expenses at 550 €", () => {
    const summary = summarizeDeductions([tx(600, "Veterinario", "Clinica Fido")], 0);
    expect(summary.refund).toBe(79.97); // (550 - 129.11) × 19%
  });

  it("gives each person their own franchigia", () => {
    const summary = summarizeDeductions(
      [
        tx(100, "Visite mediche", "Visita", { memberId: "anna" }),
        tx(100, "Visite mediche", "Visita", { memberId: "luca" }),
      ],
      0,
    );
    expect(summary.refund).toBe(0);
    expect(summary.byType[0].belowFranchigia).toBe(true);
  });

  it("multiplies the per-child limits by the children", () => {
    const school = [tx(2000, "Scuola", "Retta scolastica")];
    expect(summarizeDeductions(school, 0).refund).toBe(152); // 800 × 19%
    expect(summarizeDeductions(school, 2).refund).toBe(304); // 1.600 × 19%
  });

  it("waits for confirmation on uncertain expenses, and follows the user's choice", () => {
    const loan = tx(500, "Casa", "Rata mutuo");
    expect(summarizeDeductions([loan], 0)).toMatchObject({ refund: 0, toCheck: 1 });
    expect(summarizeDeductions([{ ...loan, override: "mutuo" }], 0).refund).toBe(95);
    const excluded = summarizeDeductions(
      [{ ...tx(300, "Visite mediche", "Visita"), override: "none" }],
      0,
    );
    expect(excluded.refund).toBe(0);
    expect(excluded.lines[0].status).toBe("excluded");
  });

  it("lets the user mark any expense as deductible", () => {
    const summary = summarizeDeductions(
      [{ ...tx(400, "Shopping", "Occhiali da vista Salmoiraghi"), override: "sanitarie" }],
      0,
    );
    expect(summary.refund).toBe(51.47); // (400 - 129.11) × 19%
  });
});
