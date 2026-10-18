/*
 * "ISEE e bonus": when to renew the ISEE, what it asks for, and the figures Orbitly already knows.
 * The ISEE of a year (valid until 31 December) uses income and savings of two years before: for
 * every account, the balance on 31 December and the average daily balance ("giacenza media").
 * Orbitly computes both from the movements, account by account.
 */

export const ISEE_CHECKED_AT = "ottobre 2026";

/** The year whose savings and income the ISEE of `iseeYear` uses. */
export const iseeBaseYear = (iseeYear: number) => iseeYear - 2;

/** The key dates of the ISEE of a year. */
export function iseeCalendar(iseeYear: number) {
  return {
    /** A new DSU can be filed from January. */
    renewFrom: `${iseeYear}-01-01`,
    /** Assegno unico: with an ISEE by the end of February, March is paid in full. */
    assegnoUnicoBy: `${iseeYear}-02-${iseeYear % 4 === 0 ? 29 : 28}`,
    /** …and filed by 30 June, the months since March are paid back. */
    arrearsBy: `${iseeYear}-06-30`,
    expires: `${iseeYear}-12-31`,
  };
}

export type IseeAccount = {
  id: string;
  name: string;
  type: "CHECKING" | "CASH" | "CARD" | "SAVINGS" | "INVESTMENT";
  /** The account's own currency: the figures are in it. */
  currency: string;
  initialBalance: number;
  /** Day the account starts: its creation or its first movement, whichever comes first. */
  startsOn: string;
};

/** One movement as it touches accounts, in each account's own currency. */
export type IseeMovement = {
  date: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  accountId: string;
  transferAccountId: string | null;
  amount: number;
  /** What the destination receives in a transfer between currencies. */
  transferAmount: number | null;
};

export type AccountFigures = {
  id: string;
  name: string;
  type: IseeAccount["type"];
  currency: string;
  /** Balance at the end of 31 December (or of `until`, for the year in progress). */
  end: number;
  /** Average of the end-of-day balances over the year: what the DSU calls "giacenza media". */
  average: number;
};

const cents = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 86_400_000;
const dayIndex = (iso: string, year: number) =>
  Math.floor((Date.parse(`${iso}T00:00:00Z`) - Date.UTC(year, 0, 1)) / DAY_MS);

/**
 * Balance on 31 December and average daily balance of each account in `year`. Before the account
 * starts its balance is zero; cash isn't asked by the DSU and is left out. For the year in
 * progress, `until` (today) ends the count: the average is of the days gone by.
 */
export function accountFigures(
  accounts: IseeAccount[],
  movements: IseeMovement[],
  year: number,
  until?: string,
): AccountFigures[] {
  const fullYear = dayIndex(`${year + 1}-01-01`, year);
  const days = until && until < `${year}-12-31` ? Math.max(1, dayIndex(until, year) + 1) : fullYear;
  const yearEnd = `${year}-12-31`;
  return accounts
    .filter((a) => a.type !== "CASH" && a.startsOn <= yearEnd)
    .map((account) => {
      const deltas: { date: string; delta: number }[] = [];
      for (const m of movements) {
        if (m.accountId === account.id) {
          deltas.push({ date: m.date, delta: m.type === "INCOME" ? m.amount : -m.amount });
        }
        if (m.type === "TRANSFER" && m.transferAccountId === account.id) {
          deltas.push({ date: m.date, delta: m.transferAmount ?? m.amount });
        }
      }
      const startsAt = dayIndex(account.startsOn, year);
      let balance =
        startsAt <= 0
          ? account.initialBalance +
            deltas.filter((d) => d.date < `${year}-01-01`).reduce((s, d) => s + d.delta, 0)
          : 0;
      const byDay = new Map<number, number>();
      for (const d of deltas) {
        const i = dayIndex(d.date, year);
        if (i >= 0 && i < days) byDay.set(i, (byDay.get(i) ?? 0) + d.delta);
      }
      let sum = 0;
      for (let i = 0; i < days; i++) {
        if (i === startsAt && startsAt > 0) balance = account.initialBalance;
        balance += byDay.get(i) ?? 0;
        sum += i >= startsAt || startsAt <= 0 ? balance : 0;
      }
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        end: cents(balance),
        average: cents(sum / days),
      };
    });
}
