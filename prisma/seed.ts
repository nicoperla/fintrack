import { AccountType, PrismaClient, TransactionType } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@fintrack.app";
const DEMO_PASSWORD = "demo1234";
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

type CategorySeed = {
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  children?: { name: string; icon: string }[];
};

const CATEGORIES: CategorySeed[] = [
  {
    name: "Casa",
    type: "EXPENSE",
    icon: "home",
    color: "#6366f1",
    children: [
      { name: "Affitto", icon: "key-round" },
      { name: "Bollette", icon: "zap" },
      { name: "Manutenzione", icon: "wrench" },
    ],
  },
  {
    name: "Spesa",
    type: "EXPENSE",
    icon: "shopping-cart",
    color: "#22c55e",
    children: [{ name: "Supermercato", icon: "store" }],
  },
  {
    name: "Trasporti",
    type: "EXPENSE",
    icon: "car",
    color: "#f59e0b",
    children: [
      { name: "Carburante", icon: "fuel" },
      { name: "Trasporto pubblico", icon: "train-front" },
    ],
  },
  {
    name: "Ristoranti e bar",
    type: "EXPENSE",
    icon: "utensils",
    color: "#ef4444",
    children: [
      { name: "Ristoranti", icon: "utensils-crossed" },
      { name: "Bar e caffè", icon: "coffee" },
    ],
  },
  {
    name: "Abbonamenti",
    type: "EXPENSE",
    icon: "repeat",
    color: "#a855f7",
    children: [
      { name: "Streaming", icon: "tv" },
      { name: "Palestra", icon: "dumbbell" },
      { name: "Telefono e internet", icon: "wifi" },
    ],
  },
  {
    name: "Svago",
    type: "EXPENSE",
    icon: "gamepad-2",
    color: "#ec4899",
    children: [
      { name: "Cinema e eventi", icon: "clapperboard" },
      { name: "Hobby", icon: "palette" },
    ],
  },
  { name: "Salute", type: "EXPENSE", icon: "heart-pulse", color: "#14b8a6" },
  { name: "Shopping", type: "EXPENSE", icon: "shopping-bag", color: "#f97316" },
  { name: "Stipendio", type: "INCOME", icon: "briefcase", color: "#16a34a" },
  { name: "Rimborsi", type: "INCOME", icon: "undo-2", color: "#0ea5e9" },
  { name: "Altre entrate", type: "INCOME", icon: "plus-circle", color: "#84cc16" },
];

const ACCOUNTS = [
  { key: "checking", name: "Conto corrente", type: AccountType.CHECKING, initialBalance: 2450 },
  { key: "card", name: "Carta di credito", type: AccountType.CARD, initialBalance: 0 },
  { key: "cash", name: "Contanti", type: AccountType.CASH, initialBalance: 200 },
  { key: "savings", name: "Conto risparmio", type: AccountType.SAVINGS, initialBalance: 8000 },
] as const;
type AccountKey = (typeof ACCOUNTS)[number]["key"];

type TxSeed = {
  account: AccountKey;
  category: string;
  type: TransactionType;
  amount: number;
  date: Date;
  description: string;
  notes?: string;
  tags?: string[];
};

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
      amount: 2150,
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

  return txs.sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function main() {
  const now = new Date();
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: { email: DEMO_EMAIL, name: "Demo", passwordHash: await hashPassword(DEMO_PASSWORD) },
  });

  const accountIds = {} as Record<AccountKey, string>;
  for (const acc of ACCOUNTS) {
    const created = await prisma.financialAccount.create({
      data: {
        userId: user.id,
        name: acc.name,
        type: acc.type,
        initialBalance: money(acc.initialBalance),
      },
    });
    accountIds[acc.key] = created.id;
  }

  const categoryIds = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const parent = await prisma.category.create({
      data: { userId: user.id, name: cat.name, type: cat.type, icon: cat.icon, color: cat.color },
    });
    categoryIds.set(cat.name, parent.id);
    for (const child of cat.children ?? []) {
      const created = await prisma.category.create({
        data: {
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

  const transactions = buildTransactions(today);
  await prisma.transaction.createMany({
    data: transactions.map((tx) => {
      const categoryId = categoryIds.get(tx.category);
      if (!categoryId) throw new Error(`Categoria sconosciuta: ${tx.category}`);
      return {
        userId: user.id,
        accountId: accountIds[tx.account],
        categoryId,
        type: tx.type,
        amount: money(tx.amount),
        date: tx.date,
        description: tx.description,
        notes: tx.notes,
        tags: tx.tags ?? [],
      };
    }),
  });

  console.log(
    `Seed completato: ${ACCOUNTS.length} conti, ${categoryIds.size} categorie, ${transactions.length} transazioni.`,
  );
  console.log(`Login demo -> email: ${DEMO_EMAIL}  password: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
