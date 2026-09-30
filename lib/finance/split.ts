/*
 * "Conti chiari": who paid what for the shared expenses of a space, what each member should have
 * paid (equally or in proportion to income) and the fewest transfers that even things out.
 */

export type SplitMode = "EQUAL" | "INCOME";

export type SplitMember = {
  userId: string;
  name: string;
  /** Net monthly income, for the proportional split; null when unknown. */
  income: number | null;
};

export type SplitExpense = { userId: string | null; amount: number };
export type SplitSettlement = { fromUserId: string; toUserId: string; amount: number };

export type SplitTransfer = { fromUserId: string; toUserId: string; amount: number };

export type SplitResult = {
  /** The mode actually applied: INCOME falls back to EQUAL when an income is missing. */
  mode: SplitMode;
  fallback: boolean;
  total: number;
  /** Expenses recorded by people no longer in the space: not attributed to anyone. */
  unattributed: number;
  members: (SplitMember & {
    /** Fraction of the shared expenses this member should cover (0–1). */
    share: number;
    paid: number;
    fairShare: number;
    /** Positive: the others owe this member; negative: this member owes. */
    balance: number;
  })[];
  transfers: SplitTransfer[];
};

// Symmetric rounding: +601,605 and −601,605 must become the same figure on both sides.
// (+ 0 turns −0 into 0, which would print as "-0,00 €".)
const cents = (n: number) => (Math.sign(n) * Math.round(Math.abs(n) * 100)) / 100 + 0;

/** Each member's fraction of the shared costs. */
export function splitShares(members: SplitMember[], mode: SplitMode) {
  const equal = () => new Map(members.map((m) => [m.userId, 1 / members.length]));
  if (mode === "EQUAL" || members.length === 0) {
    return { shares: equal(), mode: "EQUAL" as SplitMode, fallback: false };
  }
  const known = members.every((m) => m.income !== null && m.income > 0);
  if (!known) return { shares: equal(), mode: "EQUAL" as SplitMode, fallback: true };
  const total = members.reduce((s, m) => s + m.income!, 0);
  return {
    shares: new Map(members.map((m) => [m.userId, m.income! / total])),
    mode: "INCOME" as SplitMode,
    fallback: false,
  };
}

/** Greedy matching of the largest debtor with the largest creditor: at most n − 1 transfers. */
export function settleUp(balances: { userId: string; balance: number }[]): SplitTransfer[] {
  const debtors = balances
    .filter((b) => b.balance < -0.004)
    .map((b) => ({ ...b, left: -b.balance }))
    .sort((a, b) => b.left - a.left);
  const creditors = balances
    .filter((b) => b.balance > 0.004)
    .map((b) => ({ ...b, left: b.balance }))
    .sort((a, b) => b.left - a.left);

  const transfers: SplitTransfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    if (amount >= 0.01) {
      transfers.push({
        fromUserId: debtors[i].userId,
        toUserId: creditors[j].userId,
        amount: cents(amount),
      });
    }
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left < 0.005) i++;
    if (creditors[j].left < 0.005) j++;
  }
  return transfers;
}

export function computeSplit(input: {
  members: SplitMember[];
  expenses: SplitExpense[];
  settlements: SplitSettlement[];
  mode: SplitMode;
}): SplitResult {
  const { shares, mode, fallback } = splitShares(input.members, input.mode);
  const ids = new Set(input.members.map((m) => m.userId));

  const paid = new Map<string, number>();
  let unattributed = 0;
  for (const e of input.expenses) {
    if (e.userId && ids.has(e.userId)) paid.set(e.userId, (paid.get(e.userId) ?? 0) + e.amount);
    else unattributed += e.amount;
  }
  const total = Array.from(paid.values()).reduce((s, v) => s + v, 0);

  // Money already handed over: the payer's debt shrinks, the receiver's credit too.
  const settled = new Map<string, number>();
  for (const s of input.settlements) {
    if (!ids.has(s.fromUserId) || !ids.has(s.toUserId)) continue;
    settled.set(s.fromUserId, (settled.get(s.fromUserId) ?? 0) + s.amount);
    settled.set(s.toUserId, (settled.get(s.toUserId) ?? 0) - s.amount);
  }

  const members = input.members.map((m) => {
    const share = shares.get(m.userId) ?? 0;
    const memberPaid = paid.get(m.userId) ?? 0;
    const fairShare = total * share;
    return {
      ...m,
      share,
      paid: cents(memberPaid),
      fairShare: cents(fairShare),
      balance: cents(memberPaid - fairShare + (settled.get(m.userId) ?? 0)),
    };
  });

  return {
    mode,
    fallback,
    total: cents(total),
    unattributed: cents(unattributed),
    members,
    transfers: settleUp(members),
  };
}
