const APP_TIME_ZONE = "Europe/Rome";

/** Today's calendar date in Italy, independent of the server's time zone (UTC on Vercel). */
export function todayInAppTimeZone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

export function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

/** The current month in Italy as a half-open [start, end) range of UTC-midnight dates. */
export function currentMonth() {
  const today = todayInAppTimeZone();
  const start = utcDate(today.year, today.month, 1);
  const end = utcDate(today.year, today.month + 1, 1);
  const daysInMonth = utcDate(today.year, today.month + 1, 0).getUTCDate();
  return { ...today, start, end, daysInMonth };
}

const monthLong = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const formatMonth = (d: Date) => monthLong.format(d);
export const formatMonthShort = (d: Date) => capitalize(monthShort.format(d).replace(".", ""));
export const formatMonthYear = (d: Date) => capitalize(monthYear.format(d));
