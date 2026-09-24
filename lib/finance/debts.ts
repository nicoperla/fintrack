export type DebtInput = {
  id: string;
  name: string;
  balance: number;
  /** Annual interest rate in percent (TAN). */
  apr: number;
  minPayment: number;
};

export type Strategy = "snowball" | "avalanche";

export type PayoffResult = {
  feasible: boolean;
  months: number;
  totalInterest: number;
  totalPaid: number;
  /** Total remaining balance at the end of each month; index 0 is today. */
  balances: number[];
  payoffs: { id: string; name: string; month: number; interest: number }[];
};

const round = (n: number) => Math.round(n * 100) / 100;

function priorityOrder(debts: { id: string; balance: number; apr: number }[], strategy: Strategy) {
  return [...debts].sort((a, b) =>
    strategy === "snowball"
      ? a.balance - b.balance || b.apr - a.apr
      : b.apr - a.apr || a.balance - b.balance,
  );
}

/**
 * Month-by-month payoff with a fixed total budget (all minimum payments + extra). Interest accrues
 * monthly (apr / 12); minimums are paid on every open debt, and whatever is left goes to the
 * priority debt — smallest balance (snowball) or highest rate (avalanche). When a debt is closed its
 * minimum keeps going into the pot, which is what makes both methods accelerate.
 */
export function simulatePayoff(
  debts: DebtInput[],
  extraMonthly: number,
  strategy: Strategy,
  maxMonths = 600,
): PayoffResult {
  const state = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d, balance: round(d.balance), interestPaid: 0 }));
  const budget = debts.reduce((s, d) => s + d.minPayment, 0) + Math.max(0, extraMonthly);

  const balances = [round(state.reduce((s, d) => s + d.balance, 0))];
  const payoffs: PayoffResult["payoffs"] = [];
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;

  while (state.some((d) => d.balance > 0) && month < maxMonths) {
    month++;
    const open = state.filter((d) => d.balance > 0);

    for (const d of open) {
      const interest = round((d.balance * d.apr) / 100 / 12);
      d.balance = round(d.balance + interest);
      d.interestPaid += interest;
      totalInterest += interest;
    }

    let available = budget;
    for (const d of open) {
      const pay = Math.min(d.minPayment, d.balance, available);
      d.balance = round(d.balance - pay);
      available -= pay;
    }
    for (const d of priorityOrder(open, strategy)) {
      if (available <= 0) break;
      const pay = Math.min(d.balance, available);
      d.balance = round(d.balance - pay);
      available -= pay;
    }
    totalPaid += budget - available;

    for (const d of open) {
      if (d.balance <= 0 && !payoffs.some((p) => p.id === d.id)) {
        d.balance = 0;
        payoffs.push({ id: d.id, name: d.name, month, interest: round(d.interestPaid) });
      }
    }

    const remaining = round(state.reduce((s, d) => s + d.balance, 0));
    // If the budget doesn't even cover the interest, the debt never shrinks.
    if (month >= 2 && remaining >= balances[balances.length - 1]) {
      balances.push(remaining);
      return {
        feasible: false,
        months: month,
        totalInterest: round(totalInterest),
        totalPaid: round(totalPaid),
        balances,
        payoffs,
      };
    }
    balances.push(remaining);
  }

  return {
    feasible: state.every((d) => d.balance <= 0),
    months: month,
    totalInterest: round(totalInterest),
    totalPaid: round(totalPaid),
    balances,
    payoffs,
  };
}
