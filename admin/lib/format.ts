const ROME = "Europe/Rome";

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ROME,
});
const dateTimeFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ROME,
});
const timeFormat = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ROME,
});

export const formatDate = (date: Date | string | null | undefined) =>
  date ? dateFormat.format(new Date(date)) : "—";

export const formatDateTime = (date: Date | string | null | undefined) =>
  date ? dateTimeFormat.format(new Date(date)) : "—";

export const formatTime = (date: Date | string) => timeFormat.format(new Date(date));

export function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(amount);
}

export const formatNumber = (value: number) => new Intl.NumberFormat("it-IT").format(value);

export function formatPercent(part: number, total: number) {
  if (total === 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

/** "3 giorni fa", "oggi". */
export function relativeDays(date: Date | string | null | undefined, now = new Date()) {
  if (!date) return "mai";
  const days = Math.floor((now.getTime() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 30) return `${days} giorni fa`;
  const months = Math.floor(days / 30);
  return months === 1 ? "un mese fa" : `${months} mesi fa`;
}

/** The day in Rome, "2026-10-09", for grouping. */
export function romeDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ROME }).format(date);
}

// "l'1", "l'8", "l'11": these days are read with a leading vowel sound.
const romeDayOfMonth = (date: Date | string) =>
  Number(
    new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: ROME }).format(new Date(date)),
  );
const elided = (date: Date | string) => [1, 8, 11].includes(romeDayOfMonth(date));

/** "il 9 ott 2026", "l'8 ott 2026" (with the time: "il 9 ott 2026, 09:28"). */
export const onDate = (date: Date | string, withTime = false) =>
  `${elided(date) ? "l'" : "il "}${withTime ? formatDateTime(date) : formatDate(date)}`;

/** "dal 9 ott 2026", "dall'8 ott 2026". */
export const sinceDate = (date: Date | string) =>
  `${elided(date) ? "dall'" : "dal "}${formatDate(date)}`;
