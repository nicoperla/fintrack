/*
 * "Il 730 che si scrive da solo": which recorded expenses lower the IRPEF, how much of them counts
 * after franchigie and limits, and how much refund that means. Most are detrazioni (a share of the
 * expense comes off the tax: 19%, 30% for donations); two are deduzioni (the expense comes off the
 * income, so it's worth the marginal IRPEF rate).
 *
 * Rules for expenses from 2025 onwards (730/2026 and 730/2027), checked in October 2026 against
 * the official 730/2026 instructions (updated 28 May 2026). They change with the budget laws:
 * update RULES and RULES_CHECKED_AT every year. Everything here is an estimate: the limits for
 * incomes over 75,000 € and incapienza are handled only by the simulation (lib/tax/simulate.ts).
 */

export const RULES_CHECKED_AT = "ottobre 2026";

export type DeductionType =
  | "sanitarie"
  | "veterinarie"
  | "istruzione"
  | "sport"
  | "asilo"
  | "trasporto"
  | "assicurazione"
  | "mutuo"
  | "universita"
  | "funebri"
  | "studenti"
  | "donazioni"
  | "previdenza"
  | "colf";

/** Where it goes in the 730: the line of quadro E and, for lines E7–E10, the code. */
export type Where = { line: string; code?: string };

type Rule = {
  label: string;
  /** "detrazione": rate × expense off the tax. "deduzione": off the income, worth the marginal rate. */
  kind: "detrazione" | "deduzione";
  /** For detrazioni; deduzioni use the person's marginal rate. */
  rate: number;
  /** Only the part above this is deductible (per taxpayer). */
  franchigia?: number;
  /** Maximum expense that counts (per taxpayer, or per child when `perChild`). */
  cap?: number;
  perChild?: boolean;
  /** Must be paid by card, bank transfer or other traceable means (with the listed exceptions). */
  traceable: boolean;
  /** What to keep for the CAF or the precompilato. */
  documents: string;
  note?: string;
  where: Where;
};

/** What a deduzione is worth when the income isn't known: the lowest IRPEF rate ("almeno"). */
export const MIN_MARGINAL_RATE = 0.23;

export const RULES: Record<DeductionType, Rule> = {
  sanitarie: {
    label: "Spese sanitarie",
    kind: "detrazione",
    where: { line: "E1" },
    rate: 0.19,
    franchigia: 129.11,
    traceable: true,
    documents:
      "Scontrino parlante o fattura con il tuo codice fiscale; per le visite private anche la prova del pagamento con carta o bonifico.",
    note: "Farmaci, dispositivi medici e prestazioni del Servizio sanitario valgono anche se pagati in contanti.",
  },
  veterinarie: {
    label: "Spese veterinarie",
    kind: "detrazione",
    where: { line: "E8–E10", code: "29" },
    rate: 0.19,
    franchigia: 129.11,
    cap: 550,
    traceable: true,
    documents: "Fattura del veterinario e scontrino parlante per i farmaci dell'animale.",
  },
  istruzione: {
    label: "Scuola dei figli",
    kind: "detrazione",
    where: { line: "E8–E10", code: "12" },
    rate: 0.19,
    cap: 1000,
    perChild: true,
    traceable: true,
    documents: "Ricevute di rette, mensa, gite e contributi scolastici intestate a te o al figlio.",
    note: "Dall'infanzia alle superiori; dal 2025 il limite è 1.000 € per ogni studente.",
  },
  sport: {
    label: "Sport dei figli (5-18 anni)",
    kind: "detrazione",
    where: { line: "E8–E10", code: "16" },
    rate: 0.19,
    cap: 210,
    perChild: true,
    traceable: true,
    documents: "Ricevuta della società sportiva o della palestra con i dati del ragazzo.",
  },
  asilo: {
    label: "Asilo nido",
    kind: "detrazione",
    where: { line: "E8–E10", code: "33" },
    rate: 0.19,
    cap: 632,
    perChild: true,
    traceable: true,
    documents: "Ricevute delle rette del nido.",
    note: "Non si somma al bonus asilo nido INPS per le stesse rette.",
  },
  trasporto: {
    label: "Abbonamenti ai mezzi pubblici",
    kind: "detrazione",
    where: { line: "E8–E10", code: "40" },
    rate: 0.19,
    cap: 250,
    traceable: true,
    documents:
      "L'abbonamento nominativo e la prova del pagamento. I biglietti singoli non valgono.",
  },
  assicurazione: {
    label: "Assicurazioni vita e infortuni",
    kind: "detrazione",
    where: { line: "E8–E10", code: "36 o 51" },
    rate: 0.19,
    cap: 530,
    traceable: true,
    documents: "L'attestazione dei premi pagati che rilascia la compagnia.",
    note: "Solo la parte che copre morte o invalidità permanente, non casa o auto. Codice 36 per le polizze fino al 2024, 51 da gennaio 2025.",
  },
  mutuo: {
    label: "Interessi del mutuo prima casa",
    kind: "detrazione",
    where: { line: "E7", code: "7, 48 o 57" },
    rate: 0.19,
    cap: 4000,
    traceable: true,
    documents: "La certificazione degli interessi pagati che invia la banca.",
    note: "Solo gli interessi, non la quota di capitale della rata. Il codice dipende da quando hai firmato il mutuo: 7 fino al 2021, 48 dal 2022 al 2024, 57 dal 2025.",
  },
  universita: {
    label: "Università",
    kind: "detrazione",
    where: { line: "E8–E10", code: "13" },
    rate: 0.19,
    traceable: true,
    documents:
      "Ricevute di tasse e contributi universitari, anche di master e specializzazioni, intestate a te o al figlio.",
    note: "Per le università non statali conta fino al limite che il Ministero fissa ogni anno per ogni area e corso.",
  },
  funebri: {
    label: "Spese funebri",
    kind: "detrazione",
    where: { line: "E8–E10", code: "14" },
    rate: 0.19,
    cap: 1550,
    traceable: true,
    documents: "La fattura delle onoranze funebri intestata a chi ha pagato.",
    note: "Il limite di 1.550 € vale per ogni decesso, anche se pagano più persone.",
  },
  studenti: {
    label: "Affitto per studenti fuori sede",
    kind: "detrazione",
    where: { line: "E8–E10", code: "18" },
    rate: 0.19,
    cap: 2633,
    traceable: true,
    documents:
      "Il contratto d'affitto registrato (o di ospitalità con un ente per il diritto allo studio) e le ricevute dei canoni.",
    note: "L'università deve essere ad almeno 100 km dal comune di residenza, in un'altra provincia (o in un altro Paese dell'Unione europea).",
  },
  donazioni: {
    label: "Donazioni a ONLUS e terzo settore",
    kind: "detrazione",
    where: { line: "E8–E10", code: "71" },
    rate: 0.3,
    cap: 30000,
    traceable: true,
    documents:
      "La ricevuta dell'ente con i suoi dati e la prova del pagamento con bonifico o carta.",
    note: "Il 30% vale per ONLUS, associazioni di promozione sociale ed enti del terzo settore iscritti al registro; per le organizzazioni di volontariato è il 35% (codice 76).",
  },
  previdenza: {
    label: "Previdenza complementare",
    kind: "deduzione",
    where: { line: "E27" },
    rate: 0,
    cap: 5164.57,
    traceable: false,
    documents: "La comunicazione annuale del fondo pensione con i versamenti dell'anno.",
    note: "Contano i versamenti fatti da te: quelli trattenuti in busta paga il datore di lavoro li ha già dedotti. È una deduzione: rende quanto la tua aliquota IRPEF.",
  },
  colf: {
    label: "Contributi per colf, baby-sitter e badanti",
    kind: "deduzione",
    where: { line: "E23" },
    rate: 0,
    cap: 1549.37,
    traceable: false,
    documents: "Le ricevute dei versamenti trimestrali dei contributi INPS (pagoPA).",
    note: "Solo la parte dei contributi a tuo carico, non lo stipendio. Lo stipendio della badante di una persona non autosufficiente si detrae a parte (19% fino a 2.100 €, con reddito fino a 40.000 €).",
  },
};

export const DEDUCTION_TYPES = Object.keys(RULES) as DeductionType[];
export const isDeductionType = (v: string | null): v is DeductionType => v !== null && v in RULES;

export type Inference = {
  type: DeductionType;
  /** "sure": counted right away; "check": shown to the user to confirm. */
  confidence: "sure" | "check";
  /** Medicines, medical devices and NHS tickets count even when paid in cash. */
  cashAllowed: boolean;
  reason?: string;
};

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Recognizes a deductible expense from its category (and parent) and description. */
export function inferDeduction(tx: {
  category: string | null;
  parent: string | null;
  description: string;
}): Inference | null {
  const cat = norm(tx.category);
  const parent = norm(tx.parent);
  const desc = norm(tx.description);
  const all = `${cat} ${desc}`;

  if (/cibo per animali|crocchette|lettiera/.test(all)) return null;
  if (/onoranze funebri|pompe funebri|\bfunerale|servizi funebri/.test(all)) {
    return { type: "funebri", confidence: "sure", cashAllowed: false };
  }
  // Before the plain rent: a student's room is its own deduction, home rent is lib/finance/rights.ts.
  if (
    /fuori sede|posto letto|studentato|residenza universitaria|collegio universitario/.test(all)
  ) {
    return {
      type: "studenti",
      confidence: "check",
      cashAllowed: false,
      reason: "Vale se l'università è ad almeno 100 km, in un'altra provincia",
    };
  }
  // Books aren't deductible, even university ones.
  if (/universit|\bateneo\b|politecnico|\bmaster\b/.test(all) && !/\blibr/.test(all)) {
    return { type: "universita", confidence: "sure", cashAllowed: false };
  }
  if (/fondo pensione|previdenza complementare|\bpip\b|\bpepp\b/.test(all)) {
    return {
      type: "previdenza",
      confidence: "check",
      cashAllowed: false,
      reason: "Contano i versamenti fatti da te, non quelli in busta paga",
    };
  }
  if (
    /contributi (inps )?(colf|badante|baby.?sitter|domestic)|inps (colf|lavoro domestico)/.test(all)
  ) {
    return { type: "colf", confidence: "sure", cashAllowed: false };
  }
  // The description only: "Regali e donazioni" is also where birthday presents go.
  if (
    /donazion|erogazione liberale|\bonlus\b|\bets\b|terzo settore|emergency|unicef|save the children|medici senza frontiere|\bairc\b|telethon|caritas|croce rossa/.test(
      desc,
    ) ||
    /^(beneficenza|donazioni)$/.test(cat)
  ) {
    return {
      type: "donazioni",
      confidence: "check",
      cashAllowed: false,
      reason: "Vale per ONLUS ed enti del terzo settore, non per regali o raccolte private",
    };
  }
  if (/veterinar/.test(all)) return { type: "veterinarie", confidence: "sure", cashAllowed: false };
  if (/farmacia|parafarmacia|medicinal|\bfarmac/.test(all)) {
    return { type: "sanitarie", confidence: "sure", cashAllowed: true };
  }
  if (/\bottic|occhiali|lenti a contatto|apparecchio acustic/.test(all)) {
    return {
      type: "sanitarie",
      confidence: "sure",
      cashAllowed: true,
      reason: "Dispositivo medico",
    };
  }
  if (/\bticket\b/.test(desc) && (parent === "salute" || /visit|sanit/.test(all))) {
    return { type: "sanitarie", confidence: "sure", cashAllowed: true, reason: "Ticket del SSN" };
  }
  if (
    /visite mediche|dentist|specialist/.test(cat) ||
    /dentist|odontoiatr|ortodont|oculist|dermatolog|cardiolog|ginecolog|pediatr|fisioterap|osteopat|psicolog|psicoterap|logoped|analisi del sangue|analisi clinic|ecografi|radiograf|risonanza|visita medica|visita special/.test(
      desc,
    )
  ) {
    return { type: "sanitarie", confidence: "sure", cashAllowed: false };
  }
  if (/asilo nido|\bnido\b/.test(all))
    return { type: "asilo", confidence: "sure", cashAllowed: false };
  if (
    cat === "scuola" ||
    /mensa scolastic|retta scolastic|gita scolastic|contributo scolastic/.test(desc)
  ) {
    return { type: "istruzione", confidence: "sure", cashAllowed: false };
  }
  if (/sport dei figli|sport figli/.test(cat)) {
    return { type: "sport", confidence: "sure", cashAllowed: false };
  }
  if (cat === "trasporto pubblico" || /\b(atm|atac|gtt|trenord|trenitalia)\b/.test(desc)) {
    return /abbonament/.test(desc)
      ? { type: "trasporto", confidence: "sure", cashAllowed: false }
      : null;
  }
  if (/interessi (passivi )?(del )?mutuo/.test(all)) {
    return { type: "mutuo", confidence: "sure", cashAllowed: false };
  }
  if (/mutuo/.test(all)) {
    return {
      type: "mutuo",
      confidence: "check",
      cashAllowed: false,
      reason: "Della rata conta solo la parte di interessi",
    };
  }
  if (/vita|infortun/.test(all) && /assicura|polizza/.test(all)) {
    return {
      type: "assicurazione",
      confidence: "check",
      cashAllowed: false,
      reason: "Vale solo la copertura vita o infortuni",
    };
  }
  if (parent === "salute" || cat === "salute") {
    return { type: "sanitarie", confidence: "check", cashAllowed: false };
  }
  return null;
}

export type DeductionStatus =
  /** Counts towards the refund. */
  | "ok"
  /** Would count, but was paid in cash. */
  | "cash"
  /** Might count: the user has to confirm. */
  | "check"
  /** The user said it doesn't count. */
  | "excluded";

export type DeductionInput = {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  /** CASH means not traceable. */
  accountType: string;
  memberId: string | null;
  category: string | null;
  parent: string | null;
  /** Manual choice: a type, "none", or null for automatic. */
  override: string | null;
};

export type DeductionLine = Omit<DeductionInput, "override" | "category" | "parent"> & {
  category: string | null;
  type: DeductionType | null;
  status: DeductionStatus;
  source: "auto" | "manual";
  reason?: string;
};

export type TypeSummary = {
  type: DeductionType;
  label: string;
  /** Expenses that count (status ok). */
  eligible: number;
  /** What's left after franchigia and limit: refund = base × rate. */
  base: number;
  refund: number;
  /** Refund missed because of cash payments (estimate, before franchigia). */
  lostToCash: number;
  /** Per member: so far below the franchigia, nothing comes back yet. */
  belowFranchigia: boolean;
  cap: number | null;
  franchigia: number | null;
};

export type MemberDeductions = { memberId: string | null; refund: number; byType: TypeSummary[] };

export type DeductionsSummary = {
  refund: number;
  lostToCash: number;
  toCheck: number;
  lines: DeductionLine[];
  members: MemberDeductions[];
  /** All members together, for the overview. */
  byType: TypeSummary[];
};

const cents = (n: number) => Math.round(n * 100) / 100;

export function classifyDeduction(input: DeductionInput): DeductionLine {
  const { override, ...rest } = input;
  const inferred = inferDeduction(input);
  const base = { ...rest, category: input.category };

  if (override === "none") {
    return { ...base, type: inferred?.type ?? null, status: "excluded", source: "manual" };
  }
  const manual = isDeductionType(override) ? override : null;
  const type = manual ?? inferred?.type ?? null;
  if (!type) return { ...base, type: null, status: "excluded", source: "auto" };

  // A manual choice confirms the type; medicines keep their cash exemption.
  const cashAllowed = inferred?.type === type ? inferred.cashAllowed : false;
  const paidCash = input.accountType === "CASH";
  const status: DeductionStatus =
    !manual && inferred?.confidence === "check"
      ? "check"
      : paidCash && RULES[type].traceable && !cashAllowed
        ? "cash"
        : "ok";
  return {
    ...base,
    type,
    status,
    source: manual ? "manual" : "auto",
    reason: inferred?.type === type ? inferred.reason : undefined,
  };
}

/** The share of an expense that comes back: the rule's rate, or the marginal rate for deduzioni. */
export function rateOf(type: DeductionType, marginalRate = MIN_MARGINAL_RATE) {
  const rule = RULES[type];
  return rule.kind === "deduzione" ? marginalRate : rule.rate;
}

/** Options shared by the summaries: the IRPEF rate deduzioni are worth (default: the lowest). */
export type SummaryOptions = { marginalRate?: number };

function summarizeType(
  type: DeductionType,
  lines: DeductionLine[],
  children: number,
  options: SummaryOptions = {},
): TypeSummary {
  const rule = { ...RULES[type], rate: rateOf(type, options.marginalRate) };
  const ofType = lines.filter((l) => l.type === type);
  const eligible = ofType.filter((l) => l.status === "ok").reduce((s, l) => s + l.amount, 0);
  const cap =
    rule.cap === undefined ? null : rule.cap * (rule.perChild ? Math.max(1, children) : 1);
  const capped = cap === null ? eligible : Math.min(eligible, cap);
  const base = Math.max(0, capped - (rule.franchigia ?? 0));
  const lost = ofType.filter((l) => l.status === "cash").reduce((s, l) => s + l.amount, 0);
  return {
    type,
    label: rule.label,
    eligible: cents(eligible),
    base: cents(base),
    refund: cents(base * rule.rate),
    lostToCash: cents(lost * rule.rate),
    belowFranchigia: eligible > 0 && rule.franchigia !== undefined && eligible <= rule.franchigia,
    cap,
    franchigia: rule.franchigia ?? null,
  };
}

/**
 * Each member files their own 730 with their own franchigia and limits: expenses are grouped by
 * who recorded them, the closest proxy for who paid.
 */
export function summarizeDeductions(
  inputs: DeductionInput[],
  children: number,
  options: SummaryOptions = {},
): DeductionsSummary {
  return summarizeLines(
    inputs.map(classifyDeduction).filter((l) => l.type !== null || l.source === "manual"),
    children,
    options,
  );
}

/** Totals for lines already classified (e.g. only one person's, for the dossier). */
export function summarizeLines(
  lines: DeductionLine[],
  children: number,
  options: SummaryOptions = {},
): DeductionsSummary {
  const memberIds = Array.from(new Set(lines.map((l) => l.memberId)));
  const members = memberIds.map((memberId) => {
    const own = lines.filter((l) => l.memberId === memberId);
    const byType = DEDUCTION_TYPES.map((t) => summarizeType(t, own, children, options)).filter(
      (t) => t.eligible > 0 || t.lostToCash > 0,
    );
    return { memberId, refund: cents(byType.reduce((s, t) => s + t.refund, 0)), byType };
  });

  const byType = DEDUCTION_TYPES.map((type) => {
    const parts = members.flatMap((m) => m.byType.filter((t) => t.type === type));
    const one = summarizeType(type, [], children, options);
    return {
      ...one,
      eligible: cents(parts.reduce((s, t) => s + t.eligible, 0)),
      base: cents(parts.reduce((s, t) => s + t.base, 0)),
      refund: cents(parts.reduce((s, t) => s + t.refund, 0)),
      lostToCash: cents(parts.reduce((s, t) => s + t.lostToCash, 0)),
      belowFranchigia: parts.length > 0 && parts.every((t) => t.belowFranchigia),
    };
  }).filter((t) => t.eligible > 0 || t.lostToCash > 0);

  return {
    refund: cents(members.reduce((s, m) => s + m.refund, 0)),
    lostToCash: cents(byType.reduce((s, t) => s + t.lostToCash, 0)),
    toCheck: lines.filter((l) => l.status === "check").length,
    lines: [...lines].sort((a, b) => b.date.localeCompare(a.date)),
    members,
    byType,
  };
}

/** The refund a single expense would bring (ignoring franchigia): for the cash warning. */
export function refundOf(amount: number, type: DeductionType, marginalRate?: number) {
  return cents(amount * rateOf(type, marginalRate));
}
