import type { TrueSalaryData } from "@/lib/data/true-salary";

/* Dates and words shared by the "Lo stipendio vero" components. */

const dayMonth = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const shortDay = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const monthLong = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" });
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "16 dicembre". */
export const formatDayMonth = (iso: string) => dayMonth.format(parse(iso));
/** "16 dic". */
export const formatShortDay = (iso: string) => shortDay.format(parse(iso)).replace(".", "");
/** "dicembre" for month 12. */
export const monthLabel = (month: number) =>
  monthLong.format(new Date(Date.UTC(2026, month - 1, 1)));
/** "dic" for month 12. */
export const monthShortLabel = (month: number) =>
  monthShort.format(new Date(Date.UTC(2026, month - 1, 1))).replace(".", "");

// "l'1", "l'8", "l'11": the numbers read with a leading vowel sound.
const elided = (day: number) => day === 1 || day === 8 || day === 11;
const dayOf = (iso: string) => Number(iso.slice(8, 10));

/** "il 16", "l'1". */
export const onDay = (day: number) => `${elided(day) ? "l'" : "il "}${day}`;
/** "il 16 dicembre", "l'1 dicembre". */
export const onDate = (iso: string) => `${elided(dayOf(iso)) ? "l'" : "il "}${formatDayMonth(iso)}`;
/** "al 27 ottobre", "all'1 novembre". */
export const toDate = (iso: string) =>
  `${elided(dayOf(iso)) ? "all'" : "al "}${formatDayMonth(iso)}`;
/** "del 16 dicembre", "dell'1 dicembre". */
export const ofDate = (iso: string) =>
  `${elided(dayOf(iso)) ? "dell'" : "del "}${formatDayMonth(iso)}`;

/** "giugno e dicembre", "maggio, agosto e novembre". */
export function monthsText(months: number[]) {
  const names = [...months].sort((a, b) => a - b).map(monthLabel);
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** "fino al 27 ottobre, quando arriva lo stipendio". */
export function untilPayday(payday: TrueSalaryData["payday"]) {
  if (payday.source === "month-end") return "fino a fine mese";
  const date = `fino ${toDate(payday.date)}`;
  return payday.source === "salary"
    ? `${date}, quando arriva lo stipendio`
    : `${date}, giorno dello stipendio`;
}

export type LastYearAmounts = Record<
  string,
  { total: number; count: number; months: number[] } | null
>;
