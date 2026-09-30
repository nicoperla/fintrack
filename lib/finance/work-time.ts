/*
 * "How long do I have to work for this?": an amount expressed in working time, from the
 * user's net monthly income and weekly hours.
 */

export type WorkRate = {
  /** Net income per working hour, in the space currency. */
  hourly: number;
  /** Hours in a working day (weekly hours over five days). */
  dayHours: number;
};

const WEEKS_PER_MONTH = 52 / 12;

export function workRate(monthlyNetIncome: number, weeklyHours: number): WorkRate | null {
  if (!(monthlyNetIncome > 0) || !(weeklyHours > 0)) return null;
  return {
    hourly: monthlyNetIncome / (weeklyHours * WEEKS_PER_MONTH),
    dayHours: weeklyHours / 5,
  };
}

/**
 * "25 min", "2 h 15 min", "3 giornate e 2 h", "circa 2 mesi": precise for small amounts,
 * rounder as they grow (nobody thinks of rent in minutes).
 */
export function formatWorkTime(amount: number, rate: WorkRate): string {
  const minutes = Math.round((Math.abs(amount) / rate.hourly) * 60);
  if (minutes < 1) return "meno di un minuto";
  if (minutes < 60) return `${minutes} min`;

  const hours = minutes / 60;
  if (hours < rate.dayHours) {
    const h = Math.floor(hours);
    const m = Math.round(((hours - h) * 60) / 5) * 5;
    if (m === 60) return `${h + 1} h`;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  const days = hours / rate.dayHours;
  const workDaysPerMonth = WEEKS_PER_MONTH * 5;
  if (days < workDaysPerMonth) {
    const d = Math.floor(days);
    const h = Math.round((days - d) * rate.dayHours);
    const dayLabel = d === 1 ? "1 giornata" : `${d} giornate`;
    if (h === 0) return dayLabel;
    if (h >= rate.dayHours) return `${d + 1} giornate`;
    return `${dayLabel} e ${h} h`;
  }

  const months = Math.round((days / workDaysPerMonth) * 2) / 2;
  const label = Number.isInteger(months) ? String(months) : String(months).replace(".", ",");
  return months === 1 ? "circa 1 mese" : `circa ${label} mesi`;
}
