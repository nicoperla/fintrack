import { normalizeDescription } from "@/lib/finance/recurring";

/*
 * "Il mese in storie": a month of movements turned into a handful of facts worth a slide each,
 * and a playful profile of how the month went.
 */

export type StoryCategory = { id: string; name: string; icon: string | null; color: string | null };

export type StoryTx = {
  date: string;
  type: "INCOME" | "EXPENSE";
  /** In the space currency. */
  amount: number;
  description: string;
  /** Top-level category. */
  category: StoryCategory | null;
};

export type StoryInput = {
  /** "YYYY-MM". */
  month: string;
  daysInMonth: number;
  /** For the current month: stop counting no-spend days at today. */
  lastDay: number;
  transactions: StoryTx[];
  previous: {
    income: number;
    expense: number;
    categories: { id: string; amount: number }[];
  } | null;
};

export type ArchetypeId =
  | "generoso"
  | "zen"
  | "minimalista"
  | "buongustaio"
  | "esploratore"
  | "shopping"
  | "festa"
  | "ribelle"
  | "collezionista"
  | "esteta"
  | "pilastro"
  | "pendolare"
  | "equilibrista";

export type Archetype = { id: ArchetypeId; name: string; description: string };

export type StoryData = {
  month: string;
  income: number;
  expense: number;
  saved: number;
  savingsRate: number | null;
  count: number;
  categories: (StoryCategory & { amount: number; share: number })[];
  biggest: {
    description: string;
    amount: number;
    date: string;
    category: StoryCategory | null;
  } | null;
  place: { name: string; count: number; amount: number } | null;
  weekday: { name: string; amount: number; share: number } | null;
  priciestDay: { date: string; amount: number; count: number } | null;
  noSpendDays: number;
  longestStreak: number;
  previous: { expense: number; change: number | null } | null;
  mover: (StoryCategory & { delta: number; pct: number | null }) | null;
  archetype: Archetype;
};

const WEEKDAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

const ARCHETYPES: Record<ArchetypeId, Omit<Archetype, "id">> = {
  generoso: {
    name: "Il Cuore Grande",
    description: "Questo mese hai speso più di quanto è entrato. Capita: il prossimo si pareggia.",
  },
  zen: {
    name: "Il Risparmiatore Zen",
    description: "Hai messo da parte almeno un terzo delle entrate. Calma, controllo, futuro.",
  },
  minimalista: {
    name: "Il Minimalista",
    description:
      "Tanti giorni senza spendere un euro: sai distinguere il necessario dal superfluo.",
  },
  buongustaio: {
    name: "Il Buongustaio",
    description: "Ristoranti, bar e cene fuori: il tuo portafoglio ha un debole per il buon cibo.",
  },
  esploratore: {
    name: "L'Esploratore",
    description: "Biglietti, alloggi, valigie: questo mese i tuoi soldi hanno viaggiato con te.",
  },
  shopping: {
    name: "Lo Shopping Addicted",
    description: "Vestiti, gadget e pacchi in arrivo: il carrello è stato il tuo migliore amico.",
  },
  festa: {
    name: "L'Anima della Festa",
    description: "Eventi, hobby e divertimento: hai investito nel tempo libero.",
  },
  ribelle: {
    name: "Lo Spirito Ribelle",
    description:
      "Tabacchi e giocate si sono presi una bella fetta del mese. Si può fare di meglio?",
  },
  collezionista: {
    name: "Il Collezionista di Abbonamenti",
    description: "Streaming, app e palestre: un abbonamento per ogni cosa.",
  },
  esteta: {
    name: "L'Esteta",
    description: "Parrucchiere, cosmetici, cura di sé: stare bene è una priorità.",
  },
  pilastro: {
    name: "Il Pilastro di Casa",
    description: "Affitto, bollette e spesa: i tuoi soldi tengono in piedi la casa.",
  },
  pendolare: {
    name: "Il Pendolare",
    description: "Benzina, treni e parcheggi: il mese è passato in movimento.",
  },
  equilibrista: {
    name: "L'Equilibrista",
    description: "Nessun eccesso, nessuna rinuncia estrema: un mese in perfetto equilibrio.",
  },
};

const BY_CATEGORY: [RegExp, ArchetypeId][] = [
  [/ristoranti|bar|cibo|pranz|cen/i, "buongustaio"],
  [/viagg|vacanz/i, "esploratore"],
  [/shopping|abbigliamento|elettronica/i, "shopping"],
  [/svago|tempo libero|divertimento|hobby/i, "festa"],
  [/tabacc|scommess|lotto|gioco/i, "ribelle"],
  [/abbonament/i, "collezionista"],
  [/cura personale|bellezza/i, "esteta"],
  [/casa|spesa|bollette|affitto/i, "pilastro"],
  [/trasport|auto|carburante/i, "pendolare"],
];

export function pickArchetype(data: {
  saved: number;
  savingsRate: number | null;
  noSpendDays: number;
  categories: { name: string; share: number }[];
}): Archetype {
  const make = (id: ArchetypeId): Archetype => ({ id, ...ARCHETYPES[id] });
  if (data.saved < 0) return make("generoso");
  if (data.savingsRate !== null && data.savingsRate >= 33) return make("zen");
  if (data.noSpendDays >= 10) return make("minimalista");
  // The top categories that are a real trait of the month, not just the biggest bill.
  for (const category of data.categories) {
    const match = BY_CATEGORY.find(([re]) => re.test(category.name));
    if (!match) continue;
    const threshold = match[1] === "pilastro" || match[1] === "pendolare" ? 0.35 : 0.15;
    if (category.share >= threshold) return make(match[1]);
  }
  return make("equilibrista");
}

export function buildStory(input: StoryInput): StoryData {
  const expenses = input.transactions.filter((t) => t.type === "EXPENSE");
  const income = input.transactions
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + t.amount, 0);
  const expense = expenses.reduce((s, t) => s + t.amount, 0);
  const saved = income - expense;
  const savingsRate = income > 0 ? (saved / income) * 100 : null;

  const byCategory = new Map<string, StoryCategory & { amount: number }>();
  for (const t of expenses) {
    const c = t.category ?? { id: "none", name: "Senza categoria", icon: null, color: null };
    const current = byCategory.get(c.id) ?? { ...c, amount: 0 };
    current.amount += t.amount;
    byCategory.set(c.id, current);
  }
  const categories = Array.from(byCategory.values())
    .sort((a, b) => b.amount - a.amount)
    .map((c) => ({ ...c, share: expense > 0 ? c.amount / expense : 0 }));

  const biggestTx = expenses.reduce<StoryTx | null>(
    (max, t) => (!max || t.amount > max.amount ? t : max),
    null,
  );

  // The place visited most often: same shop, however the description was typed.
  const places = new Map<string, { name: string; count: number; amount: number; last: string }>();
  for (const t of expenses) {
    const key = normalizeDescription(t.description);
    if (!key) continue;
    const place = places.get(key) ?? { name: t.description, count: 0, amount: 0, last: "" };
    place.count++;
    place.amount += t.amount;
    if (t.date >= place.last) {
      place.last = t.date;
      place.name = t.description;
    }
    places.set(key, place);
  }
  const topPlace = Array.from(places.values()).sort(
    (a, b) => b.count - a.count || b.amount - a.amount,
  )[0];

  const byDay = new Map<string, { amount: number; count: number }>();
  const byWeekday = new Array(7).fill(0);
  for (const t of expenses) {
    const day = byDay.get(t.date) ?? { amount: 0, count: 0 };
    day.amount += t.amount;
    day.count++;
    byDay.set(t.date, day);
    byWeekday[new Date(`${t.date}T00:00:00Z`).getUTCDay()] += t.amount;
  }
  const priciest = Array.from(byDay.entries()).sort((a, b) => b[1].amount - a[1].amount)[0];
  const weekdayIndex = byWeekday.indexOf(Math.max(...byWeekday));

  let noSpendDays = 0;
  let streak = 0;
  let longestStreak = 0;
  for (let d = 1; d <= input.lastDay; d++) {
    const iso = `${input.month}-${String(d).padStart(2, "0")}`;
    if (byDay.has(iso)) {
      streak = 0;
    } else {
      noSpendDays++;
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    }
  }

  let mover: StoryData["mover"] = null;
  if (input.previous) {
    const previousById = new Map(input.previous.categories.map((c) => [c.id, c.amount]));
    const changes = categories
      .map((c) => ({ c, before: previousById.get(c.id) ?? 0 }))
      .filter(({ c, before }) => c.name && c.id !== "none" && before > 0)
      .map(({ c, before }) => ({ c, before, delta: c.amount - before }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    if (changes && Math.abs(changes.delta) >= 20) {
      const { id, name, icon, color } = changes.c;
      mover = {
        id,
        name,
        icon,
        color,
        delta: changes.delta,
        pct: changes.before > 0 ? (changes.delta / changes.before) * 100 : null,
      };
    }
  }

  return {
    month: input.month,
    income,
    expense,
    saved,
    savingsRate,
    count: input.transactions.length,
    categories: categories.slice(0, 5),
    biggest: biggestTx
      ? {
          description: biggestTx.description,
          amount: biggestTx.amount,
          date: biggestTx.date,
          category: biggestTx.category,
        }
      : null,
    place:
      topPlace && topPlace.count >= 3
        ? { name: topPlace.name, count: topPlace.count, amount: topPlace.amount }
        : null,
    weekday:
      expense > 0
        ? {
            name: WEEKDAYS[weekdayIndex],
            amount: byWeekday[weekdayIndex],
            share: byWeekday[weekdayIndex] / expense,
          }
        : null,
    priciestDay: priciest
      ? { date: priciest[0], amount: priciest[1].amount, count: priciest[1].count }
      : null,
    noSpendDays,
    longestStreak,
    previous: input.previous
      ? {
          expense: input.previous.expense,
          change:
            input.previous.expense > 0
              ? ((expense - input.previous.expense) / input.previous.expense) * 100
              : null,
        }
      : null,
    mover,
    archetype: pickArchetype({ saved, savingsRate, noSpendDays, categories }),
  };
}
