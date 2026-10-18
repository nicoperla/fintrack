import type { HomeBonus, HomeBonusKind } from "@/lib/finance/rights";

/*
 * Home bonuses in the 730: renovation, energy saving and furniture are paid back in ten yearly
 * instalments, and the instalment has to be in every 730 for ten years. It's easy to lose one,
 * for example when changing CAF: Orbitly remembers them and says where to find each.
 *
 * Rates for spending in 2025 and 2026 (L. 207/2024 and L. 199/2025): 50% on the main home and
 * 36% on the others; for 2027 36% and 30%. Furniture: 50% on up to 5.000 €. The user can always
 * write the rate on the invoices.
 */

export const HOME_BONUS_LABELS: Record<HomeBonusKind, string> = {
  ristrutturazione: "Ristrutturazione",
  energetico: "Risparmio energetico (ecobonus)",
  mobili: "Mobili ed elettrodomestici per la casa ristrutturata",
};

export const HOME_BONUS_WHERE: Record<HomeBonusKind, string> = {
  ristrutturazione: "quadro E, sezione III A, righi E41–E43",
  energetico: "quadro E, sezione IV, righi E61–E62",
  mobili: "quadro E, sezione III C, rigo E57",
};

/** Furniture bonus: the most that counts. */
export const FURNITURE_CAP = 5000;

/** The usual rate for works paid in `year`. */
export function defaultRate(kind: HomeBonusKind, year: number, mainHome: boolean) {
  if (kind === "mobili") return 50;
  if (year <= 2026) return mainHome ? 50 : 36;
  return mainHome ? 36 : 30;
}

export type Instalment = {
  bonus: HomeBonus;
  /** 1–10: which instalment goes in this year's 730. */
  number: number;
  amount: number;
  where: string;
};

const cents = (n: number) => Math.round(n * 100) / 100;

/** The instalments that go in the 730 of income year `year`. */
export function instalmentsFor(bonuses: HomeBonus[], year: number): Instalment[] {
  return bonuses
    .filter((b) => year >= b.year && year < b.year + 10)
    .map((b) => {
      const base = b.kind === "mobili" ? Math.min(b.amount, FURNITURE_CAP) : b.amount;
      return {
        bonus: b,
        number: year - b.year + 1,
        amount: cents((base * b.rate) / 100 / 10),
        where: HOME_BONUS_WHERE[b.kind],
      };
    });
}
