/**
 * Month-end balances with monthly compounding: each month the balance earns annualRate/12,
 * then the monthly contribution is added. Index 0 is the starting balance.
 */
export function projectBalance(
  start: number,
  monthly: number,
  annualRatePct: number,
  months: number,
) {
  const rate = annualRatePct / 100 / 12;
  const values = [start];
  let value = start;
  for (let m = 1; m <= months; m++) {
    value = value * (1 + rate) + monthly;
    values.push(Math.round(value * 100) / 100);
  }
  return values;
}

/** Months needed to reach `target`, or null if it's never reached within `maxMonths`. */
export function monthsToReach(
  target: number,
  start: number,
  monthly: number,
  annualRatePct: number,
  maxMonths = 600,
) {
  if (start >= target) return 0;
  const rate = annualRatePct / 100 / 12;
  let value = start;
  for (let m = 1; m <= maxMonths; m++) {
    value = value * (1 + rate) + monthly;
    if (value >= target) return m;
  }
  return null;
}
