/** Currencies with a daily ECB reference rate (the ones Frankfurter serves). */
export const CURRENCIES = {
  EUR: "Euro",
  USD: "Dollaro statunitense",
  GBP: "Sterlina britannica",
  CHF: "Franco svizzero",
  JPY: "Yen giapponese",
  CAD: "Dollaro canadese",
  AUD: "Dollaro australiano",
  NZD: "Dollaro neozelandese",
  SEK: "Corona svedese",
  NOK: "Corona norvegese",
  DKK: "Corona danese",
  ISK: "Corona islandese",
  PLN: "Zloty polacco",
  CZK: "Corona ceca",
  HUF: "Fiorino ungherese",
  RON: "Leu rumeno",
  TRY: "Lira turca",
  CNY: "Renminbi cinese",
  HKD: "Dollaro di Hong Kong",
  SGD: "Dollaro di Singapore",
  KRW: "Won sudcoreano",
  INR: "Rupia indiana",
  IDR: "Rupia indonesiana",
  MYR: "Ringgit malese",
  PHP: "Peso filippino",
  THB: "Baht thailandese",
  ILS: "Shekel israeliano",
  BRL: "Real brasiliano",
  MXN: "Peso messicano",
  ZAR: "Rand sudafricano",
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export const CURRENCY_OPTIONS = CURRENCY_CODES.map((code) => ({
  value: code,
  label: `${code} · ${CURRENCIES[code]}`,
}));

export function isCurrency(value: string): value is CurrencyCode {
  return value in CURRENCIES;
}
