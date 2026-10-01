import { normalizeDescription, type Recurring } from "@/lib/finance/recurring";

/*
 * "Soldi ritrovati": money the user can get back or stop losing, found in their own movements.
 * Besides the 730 deductions (lib/finance/deductions.ts): duplicate charges, subscriptions that
 * got more expensive, yearly renewals about to hit, and bank fees.
 */

const DAY_MS = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const cents = (n: number) => Math.round(n * 100) / 100;

export type FoundTx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountId: string;
  account: string;
  category: string | null;
};

export type Duplicate = {
  key: string;
  date: string;
  description: string;
  amount: number;
  account: string;
};

/** Small repeated purchases (two coffees) are normal: only look at amounts from here up. */
const DUPLICATE_MIN_AMOUNT = 15;

/**
 * The same amount, at the same place, from the same account, within a day: usually a card
 * charged twice. The later charge is the one to contest.
 */
export function findDuplicates(transactions: FoundTx[], dismissed: Set<string>): Duplicate[] {
  const sorted = [...transactions]
    .filter((t) => t.amount >= DUPLICATE_MIN_AMOUNT)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const found: Duplicate[] = [];
  const used = new Set<string>();
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (used.has(a.id)) continue;
    const key = normalizeDescription(a.description);
    if (!key) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (toTime(b.date) - toTime(a.date) > DAY_MS) break;
      if (
        !used.has(b.id) &&
        b.accountId === a.accountId &&
        b.amount === a.amount &&
        normalizeDescription(b.description) === key
      ) {
        used.add(b.id);
        if (!dismissed.has(`dup:${b.id}`)) {
          found.push({
            key: `dup:${b.id}`,
            date: b.date,
            description: b.description,
            amount: b.amount,
            account: b.account,
          });
        }
        break;
      }
    }
  }
  return found.sort((a, b) => b.date.localeCompare(a.date));
}

const FREQUENCY_DAYS: Record<Recurring["frequency"], number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30.44,
  quarterly: 91.3,
  yearly: 365.25,
};

export type PriceIncrease = { key: string; name: string; from: number; to: number; yearly: number };

/** Subscriptions whose last charge went up: what the increase costs in a year. */
export function findPriceIncreases(
  recurring: Recurring[],
  dismissed: Set<string>,
): PriceIncrease[] {
  return recurring
    .filter((r) => r.active && r.type === "EXPENSE" && r.priceChange)
    .map((r) => ({
      key: `price:${r.key}:${r.lastDate}`,
      name: r.name,
      from: r.priceChange!.from,
      to: r.priceChange!.to,
      yearly: cents(
        ((r.priceChange!.to - r.priceChange!.from) * 365.25) / FREQUENCY_DAYS[r.frequency],
      ),
    }))
    .filter((p) => !dismissed.has(p.key))
    .sort((a, b) => b.yearly - a.yearly);
}

export type Renewal = { key: string; name: string; amount: number; date: string; daysLeft: number };

/** Yearly and quarterly charges due within a month: still time to cancel. */
export function findRenewals(
  recurring: Recurring[],
  today: string,
  dismissed: Set<string>,
): Renewal[] {
  return recurring
    .filter((r) => r.active && r.type === "EXPENSE")
    .filter((r) => r.frequency === "yearly" || r.frequency === "quarterly")
    .map((r) => ({
      key: `renew:${r.key}:${r.nextDate}`,
      name: r.name,
      amount: r.averageAmount,
      date: r.nextDate,
      daysLeft: Math.round((toTime(r.nextDate) - toTime(today)) / DAY_MS),
    }))
    .filter((r) => r.daysLeft >= 0 && r.daysLeft <= 30 && !dismissed.has(r.key))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

const FEE =
  /\bcanone\b|commission|spese (di )?tenuta|tenuta conto|imposta di bollo|costo (del )?conto|spese (di )?gestione/;

export type BankFees = { key: string; yearly: number; count: number; examples: string[] };

/**
 * What the bank costs in a year, from the last twelve months (annualized when there's less
 * history). Below 24 € a year there's nothing worth switching for.
 */
export function findBankFees(
  transactions: FoundTx[],
  today: string,
  trackedSince: string | null,
  dismissed: Set<string>,
): BankFees | null {
  if (dismissed.has("fees")) return null;
  const since = toTime(today) - 365 * DAY_MS;
  const fees = transactions.filter((t) => {
    if (toTime(t.date) < since) return false;
    const category = (t.category ?? "").toLowerCase();
    return category === "commissioni bancarie" || FEE.test(t.description.toLowerCase());
  });
  if (fees.length === 0) return null;
  const total = fees.reduce((s, t) => s + t.amount, 0);
  const days = trackedSince
    ? Math.max(30, Math.min(365, (toTime(today) - toTime(trackedSince)) / DAY_MS + 1))
    : 365;
  const yearly = cents((total * 365) / days);
  if (yearly < 24) return null;
  return {
    key: "fees",
    yearly,
    count: fees.length,
    examples: Array.from(new Set(fees.map((f) => f.description))).slice(0, 3),
  };
}

export type CancellableSubscription = {
  key: string;
  name: string;
  monthly: number;
  yearly: number;
};

/** Active subscriptions, for the cancellation letters. */
export function cancellableSubscriptions(
  recurring: Recurring[],
  isEssential: (categoryId: string | null) => boolean,
): CancellableSubscription[] {
  return recurring
    .filter((r) => r.active && r.type === "EXPENSE" && !isEssential(r.categoryId))
    .map((r) => ({
      key: r.key,
      name: r.name,
      monthly: r.monthlyCost,
      yearly: cents(r.monthlyCost * 12),
    }))
    .sort((a, b) => b.yearly - a.yearly);
}

const letterDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** A ready-to-send cancellation request (email or PEC). */
export function cancellationLetter(input: { service: string; fullName: string; today: string }) {
  const name = input.fullName.trim() || "[Nome e cognome]";
  const date = letterDate.format(new Date(`${input.today}T00:00:00Z`));
  return {
    subject: `Disdetta abbonamento ${input.service}`,
    body: [
      "Spettabile servizio clienti,",
      "",
      `con la presente io sottoscritto/a ${name}, titolare dell'abbonamento ${input.service} (email dell'account / numero cliente: [da completare]), comunico la disdetta del contratto con effetto dalla prima scadenza utile, e chiedo di non procedere a ulteriori addebiti.`,
      "",
      "Vi chiedo cortesemente di confermare per iscritto la ricezione della disdetta e la data di cessazione del servizio.",
      "",
      "Distinti saluti,",
      name,
      date,
    ].join("\n"),
  };
}
