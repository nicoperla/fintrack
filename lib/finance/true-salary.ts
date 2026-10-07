import { LATE_GRACE_DAYS } from "@/lib/finance/forecast";
import { addMonths, nextOccurrence, type Frequency } from "@/lib/finance/recurring";

/*
 * "Lo stipendio vero": what can be spent until the next salary, with the year's big expenses
 * ("stangate": IMU, bollo, RC auto, gifts…) already set aside. Money for each big expense is put
 * aside a little every day, from its previous payment to the next one; on the due date it goes.
 * Estimates on the user's own numbers: not tax advice.
 */

/** Accounts that can hold the money set aside for the big expenses. */
export const RESERVE_ACCOUNT_TYPES: readonly string[] = ["CHECKING", "SAVINGS", "CASH"];
/** Quarterly or yearly charges found among the movements and not counted, kept with the found-money dismissals. */
export const IGNORED_RECURRING_PREFIX = "salary:";

const DAY_MS = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (time: number) => new Date(time).toISOString().slice(0, 10);
const cents = (n: number) => Math.round(n * 100) / 100;
const sum = (values: number[]) => cents(values.reduce((total, v) => total + v, 0));
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const addDays = (iso: string, days: number) => toIso(toTime(iso) + days * DAY_MS);
export const daysBetween = (from: string, to: string) =>
  Math.round((toTime(to) - toTime(from)) / DAY_MS);

/** The day in that month (1–12), or the month's last day when it's shorter. */
export function dayOfMonth(year: number, month: number, day: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return toIso(Date.UTC(year, month - 1, Math.min(day, last)));
}

const monthsOf = (months: number[]) =>
  Array.from(new Set(months.filter((m) => m >= 1 && m <= 12))).sort((a, b) => a - b);

// ---------- Big expenses ----------

export type BigExpenseSchedule = {
  /** For the whole year: each payment is the same share of it. */
  amount: number;
  /** Months it's paid in, 1–12. */
  months: number[];
  day: number;
  /** Payments due up to this day are already paid. */
  paidThrough: string | null;
};

export type BigExpenseInput = BigExpenseSchedule & { id: string; name: string };

/** Every payment of a big expense from `from` to `to`, both included. */
export function paymentDates(
  e: Pick<BigExpenseSchedule, "months" | "day">,
  from: string,
  to: string,
) {
  const dates: string[] = [];
  const months = monthsOf(e.months);
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
    for (const month of months) {
      const date = dayOfMonth(year, month, e.day);
      if (date >= from && date <= to) dates.push(date);
    }
  }
  return dates;
}

export const paymentShare = (e: Pick<BigExpenseSchedule, "amount" | "months">) => {
  const count = monthsOf(e.months).length;
  return count > 0 ? cents(e.amount / count) : 0;
};

/** The next payment not paid yet, from today on, and the one before it: saving starts there. */
export function nextPayment(e: BigExpenseSchedule, today: string) {
  const dates = paymentDates(e, addDays(today, -400), addDays(today, 800));
  const index = dates.findIndex((d) => d >= today && (!e.paidThrough || d > e.paidThrough));
  return index > 0 ? { date: dates[index], previous: dates[index - 1] } : null;
}

/** How much of a payment should be set aside by today: none right after the last one, all of it on the day. */
function accrued(today: string, previous: string, next: string) {
  const span = daysBetween(previous, next);
  return span > 0 ? clamp01(daysBetween(previous, today) / span) : 1;
}

export type ReserveItem = {
  /** The big expense's id, or the recurring key for those found among the movements. */
  key: string;
  name: string;
  source: "manual" | "recurring";
  nextDate: string;
  nextAmount: number;
  /** What should be set aside for it today. */
  reserved: number;
  /** Due before the next salary: kept in full. */
  beforePayday: boolean;
};

export function reserveForBigExpense(
  e: BigExpenseInput,
  today: string,
  payday: string,
): ReserveItem | null {
  const share = paymentShare(e);
  const next = share > 0 ? nextPayment(e, today) : null;
  if (!next) return null;
  const beforePayday = next.date < payday;
  return {
    key: e.id,
    name: e.name,
    source: "manual",
    nextDate: next.date,
    nextAmount: share,
    reserved: cents(beforePayday ? share : share * accrued(today, next.previous, next.date)),
    beforePayday,
  };
}

/** A quarterly or yearly charge found among the movements (lib/finance/recurring.ts). */
export type RecurringBigExpense = {
  key: string;
  name: string;
  amount: number;
  nextDate: string;
  frequency: "quarterly" | "yearly";
};

export function reserveForRecurring(
  r: RecurringBigExpense,
  today: string,
  payday: string,
): ReserveItem {
  const cycle = r.frequency === "quarterly" ? 3 : 12;
  let date = r.nextDate;
  // Expected a few days ago and not recorded yet: still coming, so it's kept in full.
  while (date < addDays(today, -LATE_GRACE_DAYS)) date = addMonths(date, cycle);
  const due = date < today ? today : date;
  const beforePayday = due < payday;
  return {
    key: r.key,
    name: r.name,
    source: "recurring",
    nextDate: due,
    nextAmount: cents(r.amount),
    reserved: cents(
      beforePayday ? r.amount : r.amount * accrued(today, addMonths(date, -cycle), date),
    ),
    beforePayday,
  };
}

// ---------- Extra salaries ----------

/** When the extra salaries usually arrive: tredicesima in December, quattordicesima in July. */
export const EXTRA_SALARY_DATES = {
  thirteenth: { month: 12, day: 15 },
  fourteenth: { month: 7, day: 15 },
} as const;

/**
 * The part of an extra salary earned so far: it accrues month by month and arrives in one go, so
 * it can pay for the big expenses along the way ("spalma la tredicesima").
 */
export function accruedExtraSalary(
  amount: number | null,
  when: { month: number; day: number },
  today: string,
) {
  if (!amount || amount <= 0) return 0;
  const next = nextPayment(
    { amount, months: [when.month], day: when.day, paidThrough: null },
    today,
  );
  return next ? cents(amount * accrued(today, next.previous, next.date)) : 0;
}

// ---------- Payday and fixed expenses ----------

export type Payday = {
  date: string;
  /** Set by the user, the recorded salary, or (with neither) the end of the month. */
  source: "manual" | "salary" | "month-end";
  name: string | null;
};

export type SalarySeries = { name: string; nextDate: string; frequency: Frequency };

export function nextPayday(input: {
  today: string;
  day: number | null;
  salary: SalarySeries | null;
}): Payday {
  const { today } = input;
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const nextMonth = { year: month === 12 ? year + 1 : year, month: month === 12 ? 1 : month + 1 };
  if (input.day) {
    const date = dayOfMonth(year, month, input.day);
    return {
      date: date > today ? date : dayOfMonth(nextMonth.year, nextMonth.month, input.day),
      source: "manual",
      name: null,
    };
  }
  if (input.salary) {
    // A salary due today or late, not recorded yet, isn't in the balance: plan to the next one.
    let date = input.salary.nextDate;
    while (date <= today) date = nextOccurrence(date, input.salary.frequency);
    return { date, source: "salary", name: input.salary.name };
  }
  return { date: dayOfMonth(nextMonth.year, nextMonth.month, 1), source: "month-end", name: null };
}

export type RecurringForSalary = {
  key: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  /** Expected amount, in the space currency. */
  amount: number;
  nextDate: string;
  frequency: Frequency;
};

const FIXED_FREQUENCIES = new Set<Frequency>(["weekly", "biweekly", "monthly"]);

export type FixedItem = { name: string; date: string; amount: number };

/** The bills and subscriptions due from today until the day before the salary. */
export function fixedUntil(recurring: RecurringForSalary[], today: string, payday: string) {
  const graceStart = addDays(today, -LATE_GRACE_DAYS);
  const items: FixedItem[] = [];
  for (const r of recurring) {
    if (r.type !== "EXPENSE" || !FIXED_FREQUENCIES.has(r.frequency)) continue;
    let date = r.nextDate;
    while (date < graceStart) date = nextOccurrence(date, r.frequency);
    if (date < today) date = today;
    for (; date < payday; date = nextOccurrence(date, r.frequency)) {
      items.push({ name: r.name, date, amount: cents(r.amount) });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
}

// ---------- The number ----------

export type TrueSalaryInput = {
  today: string;
  payday: Payday;
  /** The everyday accounts (current accounts, cards, cash), without the reserve account. */
  everyday: { name: string; balance: number }[];
  /** Active recurring series: the monthly ones are fixed expenses, the others big expenses. */
  recurring: RecurringForSalary[];
  bigExpenses: BigExpenseInput[];
  extraSalaries: { thirteenth: number | null; fourteenth: number | null };
  /** Where the money for the big expenses is set aside, if anywhere. */
  reserveAccount: { name: string; balance: number } | null;
};

export function computeTrueSalary(input: TrueSalaryInput) {
  const { today, payday } = input;
  const fixed = fixedUntil(input.recurring, today, payday.date);
  const items = [
    ...input.bigExpenses.flatMap((e) => reserveForBigExpense(e, today, payday.date) ?? []),
    ...recurringBigExpenses(input.recurring).map((r) => reserveForRecurring(r, today, payday.date)),
  ].sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  const reserved = sum(items.map((i) => i.reserved));
  const extraEarned = sum([
    accruedExtraSalary(input.extraSalaries.thirteenth, EXTRA_SALARY_DATES.thirteenth, today),
    accruedExtraSalary(input.extraSalaries.fourteenth, EXTRA_SALARY_DATES.fourteenth, today),
  ]);
  // The extra salaries pay for the big expenses as they accrue, never for more than those.
  const fromExtra = Math.min(reserved, extraEarned);
  const covered = input.reserveAccount
    ? cents(Math.min(reserved - fromExtra, Math.max(0, input.reserveAccount.balance)))
    : 0;
  const held = cents(reserved - fromExtra - covered);

  const everydayTotal = sum(input.everyday.map((a) => a.balance));
  const fixedTotal = sum(fixed.map((f) => f.amount));
  const value = cents(everydayTotal - fixedTotal - held);
  const days = Math.max(1, daysBetween(today, payday.date));

  return {
    today,
    payday,
    /** Days until the salary, today included. */
    days,
    everyday: { total: everydayTotal, accounts: input.everyday },
    fixed: { total: fixedTotal, items: fixed },
    reserve: {
      items,
      /** What should be set aside today for all the big expenses. */
      reserved,
      /** Covered by the extra salaries earned so far. */
      fromExtra,
      /** Covered by the reserve account's balance. */
      covered,
      account: input.reserveAccount,
      /** Still on the everyday accounts: taken out of the true salary. */
      held,
    },
    value,
    perDay: cents(value / days),
  };
}

export type TrueSalary = ReturnType<typeof computeTrueSalary>;

export function recurringBigExpenses(recurring: RecurringForSalary[]): RecurringBigExpense[] {
  return recurring.flatMap((r) =>
    r.type === "EXPENSE" && (r.frequency === "quarterly" || r.frequency === "yearly")
      ? [
          {
            key: r.key,
            name: r.name,
            amount: r.amount,
            nextDate: r.nextDate,
            frequency: r.frequency,
          },
        ]
      : [],
  );
}

// ---------- The year ahead ----------

export type PlannedPayment = {
  name: string;
  date: string;
  amount: number;
  source: "manual" | "recurring";
  /** Already paid (marked as such, or due earlier this month). */
  paid: boolean;
};

/** The big expenses month by month, from this month for a year, and what they cost a month. */
export function yearAhead(input: {
  today: string;
  bigExpenses: BigExpenseInput[];
  recurring: RecurringForSalary[];
}) {
  const { today } = input;
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const start = dayOfMonth(year, month, 1);
  const end = addDays(dayOfMonth(year + 1, month, 1), -1);

  const payments: PlannedPayment[] = [];
  for (const e of input.bigExpenses) {
    const share = paymentShare(e);
    if (share <= 0) continue;
    for (const date of paymentDates(e, start, end)) {
      payments.push({
        name: e.name,
        date,
        amount: share,
        source: "manual",
        paid: date < today || (e.paidThrough !== null && date <= e.paidThrough),
      });
    }
  }
  for (const r of recurringBigExpenses(input.recurring)) {
    const cycle = r.frequency === "quarterly" ? 3 : 12;
    let date = r.nextDate;
    while (date < addDays(today, -LATE_GRACE_DAYS)) date = addMonths(date, cycle);
    for (; date <= end; date = addMonths(date, cycle)) {
      payments.push({
        name: r.name,
        date: date < today ? today : date,
        amount: cents(r.amount),
        source: "recurring",
        paid: false,
      });
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const key = dayOfMonth(
      year + Math.floor((month - 1 + i) / 12),
      ((month - 1 + i) % 12) + 1,
      1,
    ).slice(0, 7);
    const items = payments
      .filter((p) => p.date.startsWith(key))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { key, items, total: sum(items.map((p) => p.amount)) };
  });

  const yearly = sum([
    ...input.bigExpenses.map((e) => (paymentShare(e) > 0 ? e.amount : 0)),
    ...recurringBigExpenses(input.recurring).map((r) =>
      r.frequency === "quarterly" ? r.amount * 4 : r.amount,
    ),
  ]);
  return { months, yearly, monthly: cents(yearly / 12) };
}

// ---------- The Italian big expenses, to tick ----------

export type BigExpensePreset = {
  key: string;
  name: string;
  /** What to know before writing the amount. */
  hint: string;
  months: number[];
  day: number;
  /** How to find last year's payments: categories (or their parent) and words in the description. */
  match?: { categories?: string[]; words?: RegExp; months?: number[] };
};

export const BIG_EXPENSE_PRESETS: BigExpensePreset[] = [
  {
    key: "imu",
    name: "IMU",
    hint: "Sulle case che non sono l'abitazione principale: acconto il 16 giugno, saldo il 16 dicembre.",
    months: [6, 12],
    day: 16,
    match: { words: /\bimu\b/i },
  },
  {
    key: "tari",
    name: "TARI",
    hint: "La tassa sui rifiuti: rate e scadenze le decide il Comune, guarda l'avviso di pagamento.",
    months: [5, 11],
    day: 31,
    match: { words: /\btari\b|\btares\b|rifiuti/i },
  },
  {
    key: "bollo-auto",
    name: "Bollo auto",
    hint: "Si paga entro la fine del mese dopo la scadenza; l'importo dipende da regione e potenza dell'auto.",
    months: [1],
    day: 31,
    match: { words: /bollo auto|tassa auto|tassa automobilistica/i },
  },
  {
    key: "rc-auto",
    name: "Assicurazione auto",
    hint: "Il mese del rinnovo; due mesi se la paghi ogni sei mesi.",
    months: [1],
    day: 1,
    match: { categories: ["Assicurazione auto"], words: /\brc ?auto\b|polizza auto/i },
  },
  {
    key: "casa",
    name: "Assicurazione casa",
    hint: "Incendio, furto, responsabilità civile: il mese del rinnovo.",
    months: [1],
    day: 1,
    match: { words: /assicurazione casa|polizza casa|polizza abitazione/i },
  },
  {
    key: "regali",
    name: "Regali di Natale",
    hint: "Regali, cenoni e addobbi: quanto spendi di solito a dicembre.",
    months: [12],
    day: 1,
    match: { categories: ["Regali e donazioni"], months: [11, 12] },
  },
  {
    key: "vacanze",
    name: "Vacanze estive",
    hint: "Viaggio, alloggio e spese in vacanza.",
    months: [7],
    day: 15,
    match: { categories: ["Viaggi"], months: [6, 7, 8, 9] },
  },
  {
    key: "scuola",
    name: "Rientro a scuola",
    hint: "Libri, corredo, iscrizioni e mensa da pagare a settembre.",
    months: [9],
    day: 1,
    match: { categories: ["Scuola", "Libri"], months: [8, 9, 10] },
  },
  {
    key: "tasse-piva",
    name: "Tasse della partita IVA",
    hint: "Saldo e primo acconto a giugno, secondo acconto a novembre. Stima: verifica con il commercialista.",
    months: [6, 11],
    day: 30,
  },
  {
    key: "caldaia",
    name: "Manutenzione caldaia",
    hint: "Il controllo annuale, con il bollino.",
    months: [10],
    day: 1,
    match: { words: /caldaia/i },
  },
  {
    key: "condominio",
    name: "Conguaglio del condominio",
    hint: "La differenza da pagare a fine anno di gestione.",
    months: [6],
    day: 1,
    match: { words: /conguaglio/i },
  },
];

export const presetByKey = (key: string | null | undefined) =>
  BIG_EXPENSE_PRESETS.find((p) => p.key === key) ?? null;

export type HistoryTx = {
  date: string;
  description: string;
  amount: number;
  category: string | null;
  parentCategory: string | null;
};

function matchesPreset(preset: BigExpensePreset, tx: HistoryTx) {
  const match = preset.match;
  if (!match) return false;
  if (match.months && !match.months.includes(Number(tx.date.slice(5, 7)))) return false;
  const byCategory =
    match.categories?.some((c) => c === tx.category || c === tx.parentCategory) ?? false;
  return byCategory || (match.words?.test(tx.description) ?? false);
}

/** What the user paid for it in the last twelve months, to start from a real number. */
export function lastYearAmount(preset: BigExpensePreset, transactions: HistoryTx[], today: string) {
  const since = addDays(today, -365);
  const found = transactions.filter(
    (t) => t.date > since && t.date <= today && matchesPreset(preset, t),
  );
  if (found.length === 0) return null;
  return {
    total: sum(found.map((t) => t.amount)),
    count: found.length,
    months: monthsOf(found.map((t) => Number(t.date.slice(5, 7)))),
  };
}
