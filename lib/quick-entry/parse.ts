import { parseAmount } from "@/lib/finance/money";

export type QuickCategory = { id: string; name: string; type: "INCOME" | "EXPENSE" };
export type QuickAccount = { id: string; name: string; type: string };
export type QuickHint = { description: string; categoryId: string };

export type QuickEntryContext = {
  /** "YYYY-MM-DD" in the user's time zone. */
  today: string;
  categories: QuickCategory[];
  accounts: QuickAccount[];
  defaultAccountId: string | null;
  /** Descriptions the user already categorized, most recent first. */
  hints: QuickHint[];
};

export type QuickEntryResult = {
  amount: string | null;
  type: "INCOME" | "EXPENSE";
  date: string;
  description: string;
  categoryId: string | null;
  accountId: string | null;
  tags: string[];
};

const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Keyword → candidate category names (first match among the user's categories wins).
const KEYWORDS: [RegExp, string[]][] = [
  [/^(benzina|carburante|diesel|gasolio|rifornimento|metano|gpl)$/, ["Carburante", "Trasporti"]],
  [
    /^(spesa|supermercato|esselunga|coop|conad|lidl|carrefour|eurospin|pam|alimentari)$/,
    ["Supermercato", "Spesa"],
  ],
  [/^(caffe|bar|colazione|cappuccino|cornetto|brioche)$/, ["Bar e caffè", "Ristoranti e bar"]],
  [
    /^(pizza|pizzeria|ristorante|cena|pranzo|sushi|trattoria|osteria|aperitivo|kebab|burger|hamburger|poke)$/,
    ["Ristoranti", "Ristoranti e bar"],
  ],
  [/^(affitto|condominio)$/, ["Affitto", "Casa"]],
  [/^(luce|gas|bolletta|bollette|acqua|enel|tari)$/, ["Bollette", "Casa"]],
  [/^(idraulico|elettricista|riparazione|manutenzione)$/, ["Manutenzione", "Casa"]],
  [/^(netflix|spotify|disney|prime|dazn|youtube)$/, ["Streaming", "Abbonamenti"]],
  [/^(palestra|gym|piscina)$/, ["Palestra", "Abbonamenti"]],
  [
    /^(telefono|ricarica|internet|fibra|iliad|tim|vodafone|windtre|fastweb)$/,
    ["Telefono e internet", "Abbonamenti"],
  ],
  [
    /^(treno|bus|autobus|metro|metropolitana|tram|taxi|uber|biglietto|trenitalia|italo|atm)$/,
    ["Trasporto pubblico", "Trasporti"],
  ],
  [/^(parcheggio|autostrada|pedaggio|telepass)$/, ["Trasporti"]],
  [/^(farmacia|medico|dentista|visita|analisi|ospedale|ticket)$/, ["Salute"]],
  [/^(cinema|concerto|teatro|museo|mostra|evento)$/, ["Cinema e eventi", "Svago"]],
  [/^(libro|libri|hobby)$/, ["Hobby", "Svago"]],
  [/^(vestiti|scarpe|maglia|jeans|zara|abbigliamento|amazon|shopping|regalo)$/, ["Shopping"]],
  [/^(stipendio|busta|paga)$/, ["Stipendio"]],
  [/^(rimborso|reso)$/, ["Rimborsi"]],
];

const INCOME_WORDS =
  /^(stipendio|rimborso|entrata|incasso|ricevuto|ricevuti|guadagno|bonus|vendita)$/;
const FILLER = new Set([
  "di",
  "per",
  "da",
  "al",
  "alla",
  "allo",
  "con",
  "a",
  "il",
  "la",
  "lo",
  "le",
  "i",
  "gli",
  "un",
  "una",
  "euro",
  "eur",
  "e",
  "in",
  "del",
  "della",
  "sul",
]);

const WEEKDAYS = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];
const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

function explicitDate(day: number, month: number, year: number | null, today: string) {
  const currentYear = Number(today.slice(0, 4));
  let y = year === null ? currentYear : year < 100 ? 2000 + year : year;
  const make = (yy: number) => {
    const d = new Date(Date.UTC(yy, month - 1, day));
    return d.getUTCMonth() === month - 1 && d.getUTCDate() === day
      ? d.toISOString().slice(0, 10)
      : null;
  };
  let result = make(y);
  // "12/12" typed in September means last December.
  if (result && year === null && result > today) {
    y -= 1;
    result = make(y);
  }
  return result;
}

/** Extracts a date expression from the text; returns the date and the text without it. */
function extractDate(text: string, today: string): { date: string; rest: string } {
  const rules: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [/\b(?:l['’ ]?)?altro ?ieri\b/, () => addDays(today, -2)],
    [/\bieri\b/, () => addDays(today, -1)],
    [/\boggi\b/, () => today],
    [/\b(\d{1,2}) giorni fa\b/, (m) => addDays(today, -Number(m[1]))],
    // No "." separator: "12.05" is far more likely an amount than the 12th of May.
    [
      /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/,
      (m) => explicitDate(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null, today),
    ],
    [
      new RegExp(`\\b(\\d{1,2}) (${MONTHS.join("|")})(?: (\\d{4}))?\\b`),
      (m) =>
        explicitDate(Number(m[1]), MONTHS.indexOf(m[2]) + 1, m[3] ? Number(m[3]) : null, today),
    ],
    [
      new RegExp(`\\b(${WEEKDAYS.join("|")})(?: scors[oa])?\\b`),
      (m) => {
        const target = WEEKDAYS.indexOf(m[1]);
        const current = new Date(`${today}T00:00:00Z`).getUTCDay();
        return addDays(today, -((current - target + 7) % 7));
      },
    ],
  ];

  for (const [pattern, resolve] of rules) {
    const match = text.match(pattern);
    if (!match) continue;
    const date = resolve(match);
    if (date) return { date, rest: text.replace(match[0], " ") };
  }
  return { date: today, rest: text };
}

export function parseQuickEntry(input: string, ctx: QuickEntryContext): QuickEntryResult {
  const tags: string[] = [];
  // The text is already lowercased and stripped of accents, so ASCII classes are enough.
  let text = ` ${strip(input)} `.replace(/#([a-z0-9_-]+)/g, (_, tag: string) => {
    tags.push(tag);
    return " ";
  });

  // Dates first, so "5 agosto 10 bar" doesn't read 5 as the amount.
  const { date, rest } = extractDate(text, ctx.today);
  text = rest;

  // Amount: "35", "35,50", "€35", "35€", "+2350", "1.234,56 euro".
  let amount: string | null = null;
  let forcedIncome = false;
  text = text.replace(
    /(?:^|\s)([+-]?)€?\s?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?(?:€|euro|eur)?(?=\s)/,
    (full, sign: string, value: string) => {
      if (amount !== null) return full;
      amount = parseAmount(value);
      forcedIncome = sign === "+";
      return " ";
    },
  );

  let accountId: string | null = null;
  for (const account of ctx.accounts) {
    const name = strip(account.name);
    if (name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) {
      accountId = account.id;
      text = text.replace(name, " ");
      break;
    }
  }
  if (!accountId) {
    const byType = [
      [/\b(in )?contanti\b|\bcash\b/, "CASH"],
      [/\b(con (la )?)?carta\b/, "CARD"],
    ] as const;
    for (const [pattern, type] of byType) {
      const account = ctx.accounts.find((a) => a.type === type);
      if (account && pattern.test(text)) {
        accountId = account.id;
        text = text.replace(pattern, " ");
        break;
      }
    }
  }

  const words = text.split(/\s+/).filter((w) => w && !FILLER.has(w));
  let type: "INCOME" | "EXPENSE" =
    forcedIncome || words.some((w) => INCOME_WORDS.test(w)) ? "INCOME" : "EXPENSE";

  // Keep the user's original casing for the description.
  const originalWords = input.split(/\s+/).filter(Boolean);
  const descriptionWords = originalWords.filter((w) =>
    words.includes(strip(w).replace(/[^a-z0-9'-]/g, "")),
  );
  const description = descriptionWords.join(" ").replace(/^./, (c) => c.toUpperCase());

  const categoriesByName = new Map(ctx.categories.map((c) => [strip(c.name), c]));
  const findCategory = (names: string[]) =>
    names.map((n) => categoriesByName.get(strip(n))).find((c): c is QuickCategory => !!c) ?? null;

  let category: QuickCategory | null = null;
  const hint = ctx.hints.find((h) => strip(h.description) === strip(description));
  if (hint) category = ctx.categories.find((c) => c.id === hint.categoryId) ?? null;
  if (!category) {
    for (const word of words) {
      category = categoriesByName.get(word) ?? null;
      if (category) break;
      const keyword = KEYWORDS.find(([pattern]) => pattern.test(word));
      if (keyword) category = findCategory(keyword[1]);
      if (category) break;
    }
  }
  if (category && !forcedIncome) type = category.type;
  if (category && category.type !== type) category = null;

  return {
    amount,
    type,
    date,
    description: description || category?.name || (type === "INCOME" ? "Entrata" : "Spesa"),
    categoryId: category?.id ?? null,
    accountId: accountId ?? ctx.defaultAccountId,
    tags,
  };
}
