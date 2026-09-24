export type BudgetStatus = "ok" | "warning" | "over";

export function budgetUsage(spent: number, limit: number, alertThresholdPct: number) {
  const ratio = limit > 0 ? spent / limit : 0;
  const status: BudgetStatus =
    ratio > 1 ? "over" : ratio * 100 >= alertThresholdPct ? "warning" : "ok";
  return { ratio, status, remaining: limit - spent };
}

/** What can still be spent per day, today included, to stay within the budget. */
export function dailyAllowance(remaining: number, dayOfMonth: number, daysInMonth: number) {
  const daysLeft = Math.max(1, daysInMonth - dayOfMonth + 1);
  return remaining > 0 ? remaining / daysLeft : 0;
}

type YearMonth = { year: number; month: number };

/**
 * Monthly amount needed to reach the goal by its target date, counting the current month.
 * Null when the goal is reached or has no date; the full remainder when the date has passed.
 */
export function suggestedMonthlyContribution(
  current: number,
  target: number,
  targetDate: Date | null,
  today: YearMonth,
): number | null {
  const remaining = target - current;
  if (remaining <= 0 || !targetDate) return null;
  const months =
    (targetDate.getUTCFullYear() - today.year) * 12 + (targetDate.getUTCMonth() - today.month) + 1;
  return remaining / Math.max(1, months);
}
