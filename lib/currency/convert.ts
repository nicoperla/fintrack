/** Rates are units of a currency for 1 EUR (ECB convention); EUR itself is always 1. */
export type RateTable = Record<string, number>;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function rateOf(rates: RateTable, currency: string) {
  if (currency === "EUR") return 1;
  const rate = rates[currency];
  if (!rate) throw new CurrencyError(`Tasso di cambio non disponibile per ${currency}`);
  return rate;
}

/** Converts through EUR: 100 USD → EUR → GBP. Same currency is returned untouched. */
export function convertAmount(amount: number, from: string, to: string, rates: RateTable) {
  if (from === to) return amount;
  return round2((amount / rateOf(rates, from)) * rateOf(rates, to));
}

export class CurrencyError extends Error {}
