import type { Prisma } from "@prisma/client";

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(value: Prisma.Decimal | string | number, currency = "EUR") {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    // Italian CLDR skips grouping below 10.000 ("1186,43 €"); force "1.186,43 €" for readability.
    formatter = new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency,
      useGrouping: "always",
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(Number(value));
}

// Transaction dates are stored as UTC midnight (@db.Date): format in UTC to avoid off-by-one days.
const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(date: Date) {
  return dateFormatter.format(date);
}

/** YYYY-MM-DD, as used by <input type="date">. */
export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function todayDateInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** "€", "USD", "CHF"… as Intl writes the currency in Italian, for form labels. */
export function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat("it-IT", { style: "currency", currency })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}
