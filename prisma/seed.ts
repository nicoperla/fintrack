import { AccountType, Prisma, PrismaClient, TransactionType } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import { DEFAULT_CATEGORIES as CATEGORIES } from "../lib/defaults/categories";
import { createConverter } from "../lib/currency/rates";
import { claimLetter } from "../lib/claims/letters";
import { answerDeadline, findingKey } from "../lib/finance/claims";
import { normalizeDescription } from "../lib/finance/recurring";
import { toDateInputValue } from "../lib/format";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@fintrack.app";
const DEMO_PASSWORD = "demo1234";
// A second person sharing the demo space, to show shared budgets.
const PARTNER_EMAIL = "sara@fintrack.app";
const MONTHS_OF_HISTORY = 3;

// Deterministic PRNG so every seed run produces the same dataset.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20260924);
const between = (min: number, max: number) => min + random() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
const money = (value: number) => value.toFixed(2);

const ACCOUNTS = [
  {
    key: "checking",
    name: "Conto corrente",
    type: AccountType.CHECKING,
    initialBalance: 4200,
    currency: "EUR",
  },
  {
    key: "card",
    name: "Carta di credito",
    type: AccountType.CARD,
    initialBalance: 0,
    currency: "EUR",
  },
  { key: "cash", name: "Contanti", type: AccountType.CASH, initialBalance: 200, currency: "EUR" },
  {
    key: "savings",
    name: "Conto risparmio",
    type: AccountType.SAVINGS,
    initialBalance: 8000,
    currency: "EUR",
  },
  // Shows multi-currency: amounts in dollars, totals converted to euro at the ECB rate of the day.
  {
    key: "usd",
    name: "Conto in dollari",
    type: AccountType.CHECKING,
    initialBalance: 300,
    currency: "USD",
  },
  // Investments, apart from the money you can spend: monthly contributions and values entered by
  // hand (see buildValuations).
  {
    key: "etf",
    name: "ETF azionario globale",
    type: AccountType.INVESTMENT,
    initialBalance: 5200,
    currency: "EUR",
  },
  {
    key: "pension",
    name: "Fondo pensione",
    type: AccountType.INVESTMENT,
    initialBalance: 3100,
    currency: "EUR",
  },
] as const;
type AccountKey = (typeof ACCOUNTS)[number]["key"];

// Sized against the generated spending so the demo shows every state (ok, near limit, over).
const BUDGETS: { category: string; amount: number; alertThreshold?: number }[] = [
  { category: "Spesa", amount: 450 },
  { category: "Ristoranti e bar", amount: 180 },
  { category: "Trasporti", amount: 250 },
  { category: "Abbonamenti", amount: 100, alertThreshold: 90 },
  { category: "Shopping", amount: 150 },
];

const GOALS: {
  name: string;
  target: number;
  current: number;
  monthsAhead: number | null;
  icon: string;
  color: string;
}[] = [
  {
    name: "Vacanza in Giappone",
    target: 4000,
    current: 1350,
    monthsAhead: 9,
    icon: "plane",
    color: "#ec4899",
  },
  {
    name: "Fondo emergenza",
    target: 10000,
    current: 6200,
    monthsAhead: null,
    icon: "piggy-bank",
    color: "#22c55e",
  },
  {
    name: "Nuovo laptop",
    target: 1500,
    current: 1500,
    monthsAhead: 2,
    icon: "laptop",
    color: "#6366f1",
  },
];

type TxSeed = {
  account: AccountKey;
  category?: string;
  transferTo?: AccountKey;
  type: TransactionType;
  amount: number;
  date: Date;
  description: string;
  notes?: string;
  tags?: string[];
};

/** Sara records the cash spending and part of the groceries; the rest is the demo user's. */
function recordedBySara(tx: TxSeed) {
  return (
    tx.account === "cash" || (tx.category === "Supermercato" && tx.date.getUTCDate() % 2 === 0)
  );
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

function buildTransactions(today: Date): TxSeed[] {
  const txs: TxSeed[] = [];
  const start = utcDate(today.getUTCFullYear(), today.getUTCMonth() - MONTHS_OF_HISTORY, 1);
  const add = (tx: TxSeed) => {
    if (tx.date >= start && tx.date <= today) txs.push(tx);
  };

  for (let m = MONTHS_OF_HISTORY; m >= 0; m--) {
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth() - m;
    const daysInMonth = utcDate(year, month + 1, 0).getUTCDate();
    const d = (day: number) => utcDate(year, month, Math.min(day, daysInMonth));
    const isLastMonth = m === 0;

    add({
      account: "checking",
      category: "Stipendio",
      type: "INCOME",
      amount: 2550,
      date: d(27),
      description: "Stipendio Acme S.r.l.",
    });
    add({
      account: "checking",
      category: "Affitto",
      type: "EXPENSE",
      amount: 750,
      date: d(1),
      description: "Affitto appartamento",
      notes: "Bonifico al proprietario",
    });
    add({
      account: "checking",
      category: "Palestra",
      type: "EXPENSE",
      amount: 45,
      date: d(2),
      description: "FitLife Palestra",
    });
    add({
      account: "card",
      category: "Streaming",
      type: "EXPENSE",
      amount: isLastMonth ? 15.49 : 13.99,
      date: d(3),
      description: "Netflix",
    });
    add({
      account: "card",
      category: "Streaming",
      type: "EXPENSE",
      amount: 10.99,
      date: d(8),
      description: "Spotify",
    });
    add({
      account: "checking",
      category: "Telefono e internet",
      type: "EXPENSE",
      amount: 29.9,
      date: d(5),
      description: "Fibra TIM",
    });
    add({
      account: "checking",
      category: "Telefono e internet",
      type: "EXPENSE",
      amount: 9.99,
      date: d(15),
      description: "Iliad",
    });
    add({
      account: "checking",
      category: "Bollette",
      type: "EXPENSE",
      amount: between(55, 95),
      date: d(10),
      description: "Bolletta luce Enel",
    });
    add({
      account: "checking",
      category: "Bollette",
      type: "EXPENSE",
      amount: between(28, 60),
      date: d(18),
      description: "Bolletta gas",
    });

    for (let day = intBetween(1, 3); day <= daysInMonth; day += intBetween(3, 5)) {
      add({
        account: "checking",
        category: "Supermercato",
        type: "EXPENSE",
        amount: between(22, 115),
        date: d(day),
        description: pick(["Esselunga", "Coop", "Lidl", "Conad", "Carrefour Market"]),
      });
    }

    for (let day = intBetween(2, 6); day <= daysInMonth; day += intBetween(8, 12)) {
      add({
        account: "checking",
        category: "Carburante",
        type: "EXPENSE",
        amount: between(45, 70),
        date: d(day),
        description: pick(["Q8", "Eni Station", "IP"]),
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      if (random() < 0.35) {
        add({
          account: "cash",
          category: "Bar e caffè",
          type: "EXPENSE",
          amount: between(1.2, 4.5),
          date: d(day),
          description: pick(["Bar Centrale", "Caffè Roma", "Pasticceria Dolce Vita"]),
        });
      }
    }

    for (let day = intBetween(3, 7); day <= daysInMonth; day += intBetween(4, 8)) {
      const withFriends = random() < 0.4;
      add({
        account: "card",
        category: "Ristoranti",
        type: "EXPENSE",
        amount: between(18, 65),
        date: d(day),
        description: pick([
          "Pizzeria da Michele",
          "Sushi Zen",
          "Trattoria Il Portico",
          "Burger Lab",
          "Osteria del Borgo",
        ]),
        tags: withFriends ? ["amici"] : random() < 0.2 ? ["lavoro"] : [],
      });
    }

    for (let i = 0, n = intBetween(1, 3); i < n; i++) {
      add({
        account: "card",
        category: "Trasporto pubblico",
        type: "EXPENSE",
        amount: pick([2.2, 2.2, 4.4, 12.9]),
        date: d(intBetween(1, 28)),
        description: pick(["ATM biglietto", "Trenitalia"]),
      });
    }
    for (let i = 0, n = intBetween(1, 2); i < n; i++) {
      add({
        account: "card",
        category: "Shopping",
        type: "EXPENSE",
        amount: between(25, 120),
        date: d(intBetween(1, 28)),
        description: pick(["Zara", "Decathlon", "Amazon", "IKEA"]),
      });
    }
    if (random() < 0.7) {
      add({
        account: "card",
        category: "Cinema e eventi",
        type: "EXPENSE",
        amount: between(9, 45),
        date: d(intBetween(1, 28)),
        description: pick(["UCI Cinemas", "Concerto", "Teatro"]),
        tags: ["amici"],
      });
    }
    if (random() < 0.5) {
      add({
        account: "cash",
        category: "Salute",
        type: "EXPENSE",
        amount: between(8, 35),
        date: d(intBetween(1, 28)),
        description: "Farmacia",
      });
    }
    if (random() < 0.4) {
      add({
        account: "card",
        category: "Hobby",
        type: "EXPENSE",
        amount: between(15, 60),
        date: d(intBetween(1, 28)),
        description: pick(["Libreria Feltrinelli", "Negozio di musica"]),
      });
    }
  }

  const refundDay = utcDate(today.getUTCFullYear(), today.getUTCMonth() - 1, 12);
  add({
    account: "card",
    category: "Rimborsi",
    type: "INCOME",
    amount: 34.9,
    date: refundDay,
    description: "Rimborso Amazon",
    notes: "Reso scarpe",
  });
  // Tobacco shop, twice a week, with a scratch card now and then. Its own random sequence, so
  // adding it doesn't reshuffle the rest of the dataset.
  const tobaccoRandom = mulberry32(20260930);
  for (
    let t = start.getTime();
    t <= today.getTime();
    t += (3 + Math.floor(tobaccoRandom() * 2)) * 86_400_000
  ) {
    const date = new Date(t);
    const scratch = tobaccoRandom() < 0.2;
    add({
      account: "cash",
      category: scratch ? "Lotto e gratta e vinci" : "Sigarette",
      type: "EXPENSE",
      amount: scratch ? 5 : 6.2,
      date,
      description: scratch ? "Gratta e vinci" : "Tabaccheria",
    });
  }

  // "Soldi ritrovati": deductible expenses (one paid in cash, so lost), a monthly transport
  // pass, a card charged twice and the account fee.
  const ago = (days: number) => new Date(today.getTime() - days * 86_400_000);
  add({
    account: "card",
    category: "Visite mediche",
    type: "EXPENSE",
    amount: 120,
    date: ago(64),
    description: "Visita dermatologica",
  });
  add({
    account: "checking",
    category: "Visite mediche",
    type: "EXPENSE",
    amount: 180,
    date: ago(41),
    description: "Dentista dott. Bianchi",
    notes: "Pulizia e otturazione",
  });
  add({
    account: "cash",
    category: "Visite mediche",
    type: "EXPENSE",
    amount: 90,
    date: ago(6),
    description: "Visita oculistica",
  });
  add({
    account: "card",
    category: "Veterinario",
    type: "EXPENSE",
    amount: 165,
    date: ago(52),
    description: "Clinica veterinaria Fido",
  });
  for (let m = MONTHS_OF_HISTORY; m >= 0; m--) {
    add({
      account: "card",
      category: "Trasporto pubblico",
      type: "EXPENSE",
      amount: 39,
      date: utcDate(today.getUTCFullYear(), today.getUTCMonth() - m, 1),
      description: "Abbonamento mensile ATM",
    });
    add({
      account: "checking",
      category: "Commissioni bancarie",
      type: "EXPENSE",
      amount: 7.9,
      date: utcDate(today.getUTCFullYear(), today.getUTCMonth() - m, 5),
      description: "Canone conto corrente",
    });
  }
  for (let i = 0; i < 2; i++) {
    add({
      account: "card",
      category: "Abbigliamento",
      type: "EXPENSE",
      amount: 59.9,
      date: ago(12),
      description: "Zalando",
    });
  }
  // The second charge came back, thanks to a "Riprenditeli" claim (see seedClaims).
  add({
    account: "card",
    category: "Altre entrate",
    type: "INCOME",
    amount: 59.9,
    date: ago(4),
    description: "Rimborso Zalando",
  });

  const interestDay = utcDate(today.getUTCFullYear(), today.getUTCMonth() - 2, 30);
  add({
    account: "savings",
    category: "Altre entrate",
    type: "INCOME",
    amount: 6.5,
    date: interestDay,
    description: "Interessi maturati",
  });
  add({
    account: "checking",
    category: "Manutenzione",
    type: "EXPENSE",
    amount: 85,
    date: utcDate(today.getUTCFullYear(), today.getUTCMonth() - 2, 21),
    description: "Idraulico",
    notes: "Riparazione rubinetto cucina",
  });

  // A trip to New York, paid from the dollar account (topped up from the checking account).
  const trip = (daysAgo: number) => new Date(today.getTime() - daysAgo * 86_400_000);
  add({
    account: "checking",
    transferTo: "usd",
    type: "TRANSFER",
    amount: 900,
    date: trip(40),
    description: "Ricarica conto in dollari",
  });
  add({
    account: "usd",
    category: "Svago",
    type: "EXPENSE",
    amount: 540,
    date: trip(35),
    description: "Hotel New York",
  });
  add({
    account: "usd",
    category: "Ristoranti",
    type: "EXPENSE",
    amount: 86.4,
    date: trip(34),
    description: "Cena a Manhattan",
  });
  add({
    account: "usd",
    category: "Trasporto pubblico",
    type: "EXPENSE",
    amount: 34,
    date: trip(34),
    description: "MetroCard NYC",
  });
  add({
    account: "usd",
    category: "Cinema e eventi",
    type: "EXPENSE",
    amount: 129,
    date: trip(33),
    description: "Musical a Broadway",
  });

  // Transfers: the checking account pays off last month's credit card statement on the 5th,
  // and moves a fixed amount to savings after payday.
  const categorized = [...txs];
  for (let m = MONTHS_OF_HISTORY; m >= 0; m--) {
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth() - m;
    const prevStart = utcDate(year, month - 1, 1);
    const monthStart = utcDate(year, month, 1);
    const cardBalance = categorized
      .filter((t) => t.account === "card" && t.date >= prevStart && t.date < monthStart)
      .reduce((sum, t) => sum + (t.type === "INCOME" ? -t.amount : t.amount), 0);
    if (cardBalance > 0) {
      add({
        account: "checking",
        transferTo: "card",
        type: "TRANSFER",
        amount: Math.round(cardBalance * 100) / 100,
        date: utcDate(year, month, 5),
        description: "Saldo estratto conto carta",
      });
    }
    add({
      account: "checking",
      transferTo: "savings",
      type: "TRANSFER",
      amount: 200,
      date: utcDate(year, month, 28),
      description: "Accantonamento mensile",
    });
    // Money put into the investments: an ETF savings plan and the pension fund.
    add({
      account: "checking",
      transferTo: "etf",
      type: "TRANSFER",
      amount: 150,
      date: utcDate(year, month, 10),
      description: "PAC ETF mensile",
    });
    add({
      account: "checking",
      transferTo: "pension",
      type: "TRANSFER",
      amount: 50,
      date: utcDate(year, month, 15),
      description: "Versamento fondo pensione",
    });
  }

  // A habit worth showing off: something recorded every day of the last two weeks (up to
  // yesterday, so the demo also shows the "keep your streak alive today" nudge).
  for (let back = 13; back >= 1; back--) {
    const day = new Date(today.getTime() - back * 86_400_000);
    if (!txs.some((t) => t.date.getTime() === day.getTime() && !recordedBySara(t))) {
      add({
        account: "card",
        category: "Bar e caffè",
        type: "EXPENSE",
        amount: 1.3,
        date: day,
        description: "Caffè al bar",
      });
    }
  }

  return txs.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Values entered by hand for the investments: at the end of each past month, plus a recent one for
 * the ETF (up, a dip, up again). The pension fund's last value is over a month old, so the demo
 * also shows the reminder to update it. Returns are over what was put in up to that day.
 */
function buildValuations(today: Date, transactions: TxSeed[]) {
  const RETURNS: Partial<Record<AccountKey, number[]>> = {
    etf: [0.052, 0.071, 0.049, 0.083],
    pension: [0.019, 0.024],
  };
  const invested = (key: AccountKey, date: Date) =>
    ACCOUNTS.find((a) => a.key === key)!.initialBalance +
    transactions
      .filter((t) => t.transferTo === key && t.date <= date)
      .reduce((sum, t) => sum + t.amount, 0);
  const days = [
    ...Array.from({ length: MONTHS_OF_HISTORY }, (_, i) =>
      utcDate(today.getUTCFullYear(), today.getUTCMonth() - MONTHS_OF_HISTORY + i + 1, 0),
    ),
  ];
  // A recent value, two days ago (today, at the very start of a month: one value per day).
  const recent = new Date(today.getTime() - 2 * 86_400_000);
  days.push(recent > days[days.length - 1] ? recent : today);
  return Object.entries(RETURNS).flatMap(([key, returns]) =>
    returns!.map((r, i) => ({
      account: key as AccountKey,
      date: days[i],
      value: Math.round(invested(key as AccountKey, days[i]) * (1 + r) * 100) / 100,
    })),
  );
}

/** Pretend each movement was recorded on its own day, in the evening, never in the future. */
function recordedAt(date: Date, now: Date) {
  const evening = new Date(date.getTime() + 19 * 3_600_000);
  return evening < now ? evening : now;
}

/**
 * Three "Riprenditeli" claims, with letters and deadlines from the app's own rules: the Zalando
 * charge taken twice, already refunded; the gym cancelled but charged again, which the app spots
 * and turns into a refund to ask for; a complaint about the account fees, waiting for the bank.
 */
async function seedClaims(
  householdId: string,
  user: { id: string; name: string | null },
  today: Date,
  transactions: TxSeed[],
) {
  const DAY = 86_400_000;
  const iso = (date: Date) => toDateInputValue(date);
  const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
  const daysAgo = (days: number) => new Date(today.getTime() - days * DAY);
  const at = (date: Date, hour: number) => new Date(date.getTime() + hour * 3_600_000);
  const fullName = user.name ?? "";
  const claims: Prisma.ClaimCreateManyInput[] = [];

  // "Soldi ritrovati" flags the second of the two identical charges, in its own order.
  const [, second] = (
    await prisma.transaction.findMany({
      where: { householdId, type: "EXPENSE", description: "Zalando" },
      select: { id: true, date: true },
    })
  ).sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
  if (second) {
    const sent = daysAgo(11);
    const letter = claimLetter({
      kind: "DUPLICATE_CHARGE",
      fullName,
      counterparty: "Zalando",
      amount: 59.9,
      today: iso(sent),
      chargeDate: iso(second.date),
      chargeDescription: "Zalando",
    });
    claims.push({
      householdId,
      userId: user.id,
      kind: "DUPLICATE_CHARGE",
      status: "WON",
      findingKey: findingKey.duplicate(second.id),
      transactionId: second.id,
      counterparty: "Zalando",
      expectedAmount: money(59.9),
      recoveredAmount: money(59.9),
      ...letter,
      channel: "email",
      sentAt: sent,
      deadline: asDate(answerDeadline("DUPLICATE_CHARGE", iso(sent), true)!),
      closedAt: at(daysAgo(4), 10),
      notes: "Riaccreditati sulla carta.",
      createdAt: at(sent, 9),
    });
  }

  // Cancelled two weeks ahead for two days before the latest charge, which came anyway.
  const gym = transactions
    .filter((t) => t.description === "FitLife Palestra")
    .reduce<TxSeed | null>((last, t) => (!last || t.date > last.date ? t : last), null);
  if (gym) {
    const effectiveFrom = new Date(gym.date.getTime() - 2 * DAY);
    const sent = new Date(effectiveFrom.getTime() - 14 * DAY);
    const letter = claimLetter({
      kind: "CANCELLATION",
      fullName,
      counterparty: "FitLife Palestra",
      amount: gym.amount * 12,
      today: iso(sent),
      effectiveFrom: iso(effectiveFrom),
    });
    claims.push({
      householdId,
      userId: user.id,
      kind: "CANCELLATION",
      status: "SENT",
      findingKey: findingKey.subscription(`EXPENSE|${normalizeDescription(gym.description)}`),
      counterparty: "FitLife Palestra",
      expectedAmount: money(gym.amount * 12),
      ...letter,
      channel: "raccomandata",
      sentAt: sent,
      effectiveFrom,
      createdAt: at(sent, 8),
    });
  }

  const fees = transactions.filter((t) => t.category === "Commissioni bancarie");
  if (fees.length > 0) {
    const total = fees.reduce((sum, t) => sum + t.amount, 0);
    const sent = daysAgo(9);
    const letter = claimLetter({
      kind: "BANK_COMPLAINT",
      fullName,
      counterparty: "Conto corrente",
      amount: total,
      today: iso(sent),
      aboutFees: true,
    });
    claims.push({
      householdId,
      userId: user.id,
      kind: "BANK_COMPLAINT",
      status: "SENT",
      findingKey: findingKey.fees,
      counterparty: "Conto corrente",
      expectedAmount: money(total),
      ...letter,
      channel: "pec",
      sentAt: sent,
      deadline: asDate(answerDeadline("BANK_COMPLAINT", iso(sent), false)!),
      createdAt: at(sent, 18),
    });
  }

  await prisma.claim.createMany({ data: claims });
  return claims.length;
}

/**
 * "Lo stipendio vero" already on: the big expenses of a family renting their home (TARI is the
 * tenant's), and the number on the dashboard instead of the plain balance.
 */
async function seedTrueSalary(householdId: string, now: Date) {
  const bigExpenses = [
    { preset: "tari", name: "TARI", amount: 168, months: [5, 11], day: 30 },
    { preset: "rc-auto", name: "Assicurazione auto", amount: 480, months: [3], day: 15 },
    { preset: "bollo-auto", name: "Bollo auto", amount: 196, months: [4], day: 30 },
    { preset: "regali", name: "Regali di Natale", amount: 400, months: [12], day: 1 },
    { preset: "vacanze", name: "Vacanze estive", amount: 1200, months: [8], day: 1 },
  ];
  await prisma.bigExpense.createMany({
    data: bigExpenses.map((b) => ({ householdId, ...b, amount: money(b.amount) })),
  });
  await prisma.household.update({ where: { id: householdId }, data: { trueSalarySince: now } });
  return bigExpenses.length;
}

/**
 * "Il Tariffometro": a couple in Milan (the ATM pass) with the RC auto above the province's
 * average, the branch account read from its monthly fee, and last month's light bill above
 * ARERA's reference, its fixed price about to end. The anonymous comparison is left to choose.
 */
async function seedTariffs(householdId: string, checkingId: string, today: Date) {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const march = utcDate(year, 2, 15);
  await prisma.household.update({
    where: { id: householdId },
    data: { province: "MI", householdSize: 2 },
  });
  const checks = [
    {
      householdId,
      kind: "CAR_INSURANCE" as const,
      label: "Panda",
      // The same premium as the big expense of "Lo stipendio vero".
      amount: money(480),
      renewsOn: march > today ? march : utcDate(year + 1, 2, 15),
      bonusMalus: 1,
      ageBand: "35-44",
    },
    {
      householdId,
      kind: "BANK_ACCOUNT" as const,
      label: "Conto corrente",
      accountId: checkingId,
      accountKind: "tradizionale",
    },
    {
      householdId,
      kind: "ELECTRICITY" as const,
      label: "Luce di casa",
      amount: money(71.6),
      kwh: 198,
      periodFrom: utcDate(year, month - 1, 1),
      periodTo: utcDate(year, month, 0),
      renewsOn: utcDate(year, month, today.getUTCDate() + 24),
    },
  ];
  await prisma.tariffCheck.createMany({ data: checks });
  return checks.length;
}

/**
 * "Il caffè dei conti": Demo and Sara talked about the month before last and took two decisions,
 * one done and one still open; last month's talk is ready, waiting for them.
 */
async function seedMoneyTalk(householdId: string, userId: string, partnerId: string, today: Date) {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const talked = utcDate(year, month - 2, 1);
  const heldAt = new Date(Date.UTC(year, month - 1, 3, 19, 30));
  await prisma.moneyTalk.create({
    data: { householdId, month: talked, heldById: partnerId, heldAt },
  });
  const march = utcDate(year, 2, 1);
  await prisma.moneyDecision.createMany({
    data: [
      {
        householdId,
        month: talked,
        topic: "Budget «Spesa»",
        text: "Spesa online una volta a settimana, con la lista",
        ownerId: partnerId,
        doneAt: new Date(Date.UTC(year, month - 1, 20, 18)),
        createdAt: heldAt,
      },
      {
        householdId,
        month: talked,
        topic: "RC auto «Panda»",
        text: "Chiedere tre preventivi per la RC auto prima di rinnovare",
        ownerId: userId,
        // A couple of weeks before the policy ends (see seedTariffs).
        dueOn: march > today ? march : utcDate(year + 1, 2, 1),
        createdAt: heldAt,
      },
    ],
  });
  return 2;
}

async function main() {
  const now = new Date();
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // Deleting the owners cascades to their spaces and everything in them.
  await prisma.user.deleteMany({ where: { email: { in: [DEMO_EMAIL, PARTNER_EMAIL] } } });

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const confirmed = { emailVerifiedAt: now, termsAcceptedAt: now };
  const user = await prisma.user.create({
    // Demo accounts are ready to use: confirmed email, terms accepted.
    data: { email: DEMO_EMAIL, name: "Demo", passwordHash, ...confirmed },
  });
  const partner = await prisma.user.create({
    // Sara's salary goes to another bank: set by hand, it drives the income-based split of "Conti chiari".
    data: {
      email: PARTNER_EMAIL,
      name: "Sara",
      passwordHash,
      monthlyNetIncome: 1650,
      ...confirmed,
    },
  });
  // Personal spaces use the owner's id (see lib/households.ts); the demo one is shared with Sara.
  const householdId = user.id;
  await prisma.household.upsert({
    where: { id: householdId },
    create: { id: householdId, name: "Casa Demo", ownerId: user.id },
    update: { name: "Casa Demo" },
  });
  await prisma.household.upsert({
    where: { id: partner.id },
    create: { id: partner.id, name: "Spazio di Sara", ownerId: partner.id },
    update: {},
  });
  await prisma.householdMember.createMany({
    data: [
      { householdId, userId: user.id, role: "OWNER" },
      { householdId: partner.id, userId: partner.id, role: "OWNER" },
      { householdId, userId: partner.id, role: "MEMBER" },
    ],
    skipDuplicates: true,
  });
  await prisma.user.update({ where: { id: partner.id }, data: { activeHouseholdId: householdId } });

  // Real ECB rates for the dollar account; without network the demo simply has no dollar account.
  let converter: Awaited<ReturnType<typeof createConverter>> | null = null;
  try {
    const start = utcDate(today.getUTCFullYear(), today.getUTCMonth() - MONTHS_OF_HISTORY, 1);
    converter = await createConverter(["USD"], start, today);
    converter.convert(1, "USD", "EUR", today);
  } catch (error) {
    console.warn("Tassi di cambio non disponibili: salto il conto in dollari.", error);
    converter = null;
  }
  const accounts = ACCOUNTS.filter((a) => converter || a.currency === "EUR");

  const accountIds = {} as Record<AccountKey, string>;
  for (const acc of accounts) {
    const created = await prisma.financialAccount.create({
      data: {
        householdId,
        userId: user.id,
        name: acc.name,
        type: acc.type,
        currency: acc.currency,
        initialBalance: money(acc.initialBalance),
      },
    });
    accountIds[acc.key] = created.id;
  }

  const categoryIds = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const parent = await prisma.category.create({
      data: {
        householdId,
        userId: user.id,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
      },
    });
    categoryIds.set(cat.name, parent.id);
    for (const child of cat.children ?? []) {
      const created = await prisma.category.create({
        data: {
          householdId,
          userId: user.id,
          name: child.name,
          type: cat.type,
          icon: child.icon,
          color: cat.color,
          parentId: parent.id,
        },
      });
      categoryIds.set(child.name, created.id);
    }
  }

  const currencyOf = (key: AccountKey) => ACCOUNTS.find((a) => a.key === key)!.currency;
  const transactions = buildTransactions(today).filter(
    (tx) => accountIds[tx.account] && (!tx.transferTo || accountIds[tx.transferTo]),
  );
  await prisma.transaction.createMany({
    data: transactions.map((tx) => {
      const categoryId = tx.category ? categoryIds.get(tx.category) : null;
      if (tx.category && !categoryId) throw new Error(`Categoria sconosciuta: ${tx.category}`);
      const from = currencyOf(tx.account);
      const to = tx.transferTo ? currencyOf(tx.transferTo) : from;
      const convert = (amount: number, a: string, b: string) =>
        a === b ? amount : converter!.convert(amount, a, b, tx.date);
      const bySara = recordedBySara(tx);
      return {
        householdId,
        userId: bySara ? partner.id : user.id,
        baseAmount: money(convert(tx.amount, from, "EUR")),
        transferAmount: to !== from ? money(convert(tx.amount, from, to)) : null,
        accountId: accountIds[tx.account],
        transferAccountId: tx.transferTo ? accountIds[tx.transferTo] : null,
        categoryId,
        type: tx.type,
        amount: money(tx.amount),
        date: tx.date,
        description: tx.description,
        notes: tx.notes,
        tags: tx.tags ?? [],
        createdAt: recordedAt(tx.date, now),
      };
    }),
  });

  await prisma.investmentValuation.createMany({
    data: buildValuations(today, transactions)
      .filter((v) => accountIds[v.account])
      .map((v) => ({
        householdId,
        accountId: accountIds[v.account],
        date: v.date,
        value: money(v.value),
      })),
  });

  // A coach already set up, so the demo shows advice instead of the first-run questions.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      coachProfile: {
        method: "paga-te-stesso",
        savingsTarget: 15,
        emergencyMonths: 3,
        priorities: ["fondo-emergenza", "vizi", "viaggi"],
        protectedCategoryIds: [categoryIds.get("Viaggi")].filter((id): id is string => !!id),
        tone: "motivante",
        note: "Voglio fare il viaggio in Giappone senza toccare il fondo per gli imprevisti.",
      },
    },
  });

  await prisma.budget.createMany({
    data: BUDGETS.map((b) => {
      const categoryId = categoryIds.get(b.category);
      if (!categoryId) throw new Error(`Categoria sconosciuta: ${b.category}`);
      return {
        householdId,
        userId: user.id,
        categoryId,
        amount: money(b.amount),
        alertThreshold: b.alertThreshold ?? 80,
      };
    }),
  });

  await prisma.goal.createMany({
    data: GOALS.map((g) => ({
      householdId,
      userId: user.id,
      name: g.name,
      targetAmount: money(g.target),
      currentAmount: money(g.current),
      targetDate:
        g.monthsAhead === null
          ? null
          : utcDate(today.getUTCFullYear(), today.getUTCMonth() + g.monthsAhead + 1, 0),
      icon: g.icon,
      color: g.color,
    })),
  });

  // The smallest debt isn't the most expensive one, so snowball and avalanche pick different orders.
  const DEBTS = [
    { name: "Prestito auto", balance: 6200, rate: 6.9, minimum: 190 },
    { name: "Carta revolving", balance: 1450, rate: 17.9, minimum: 55 },
    { name: "Finanziamento divano", balance: 900, rate: 9.9, minimum: 60 },
  ];
  await prisma.debt.createMany({
    data: DEBTS.map((d) => ({
      householdId,
      userId: user.id,
      name: d.name,
      balance: money(d.balance),
      interestRate: money(d.rate),
      minimumPayment: money(d.minimum),
    })),
  });

  const claimCount = await seedClaims(householdId, user, today, transactions);
  const bigExpenseCount = await seedTrueSalary(householdId, now);
  const tariffCount = await seedTariffs(householdId, accountIds.checking, today);
  const decisionCount = await seedMoneyTalk(householdId, user.id, partner.id, today);
  // "Il fascicolo di famiglia": the notes only the family knows; no link is shared in the demo.
  await prisma.familyFile.create({
    data: {
      householdId,
      notes: {
        documenti:
          "Contratto d'affitto, polizza dell'auto e dichiarazioni dei redditi nella cartella blu, secondo cassetto dello studio. Le copie digitali sono nella cartella «Casa» del cloud.",
        contatti:
          "Commercialista: studio Bianchi, 02 1234 5678. Banca: filiale di via Roma, chiedere di Laura. Assicurazione auto: agenzia sotto casa.",
        polizze:
          "Fondo pensione con l'azienda (Acme): il modulo dei beneficiari è nella cartella blu.",
        istruzioni:
          "Disdire FitLife Palestra e Netflix. Le bollette di luce e gas sono intestate a Demo: vanno volturate.",
      },
    },
  });
  // "Radar dei diritti": company welfare to spend by the end of the year, the rent questions left
  // for the demo to answer.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      taxProfile: {
        incomeBand: null,
        birthYear: null,
        rent: { contract: null, since: null, transferred: false },
        welfare: {
          balance: 350,
          expiresOn: `${today.getUTCFullYear()}-12-31`,
          fringe: 600,
          fringeYear: today.getUTCFullYear(),
        },
      },
    },
  });

  console.log(
    `Seed completato: ${accounts.length} conti, ${categoryIds.size} categorie, ${transactions.length} transazioni, ${BUDGETS.length} budget, ${GOALS.length} obiettivi, ${DEBTS.length} debiti, ${claimCount} pratiche, ${bigExpenseCount} stangate, ${tariffCount} voci del Tariffometro, ${decisionCount} decisioni del caffè dei conti.`,
  );
  console.log(`Login demo -> email: ${DEMO_EMAIL}  password: ${DEMO_PASSWORD}`);
  console.log(
    `Seconda persona dello spazio -> email: ${PARTNER_EMAIL}  password: ${DEMO_PASSWORD}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
