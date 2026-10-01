/*
 * "Il 730 che si scrive da solo": which recorded expenses are IRPEF deductions (detrazioni al
 * 19%), how much of them counts after franchigie and limits, and how much refund that means.
 *
 * Rules for expenses from 2025 onwards (730/2026 and 730/2027), checked October 2026. They change
 * with the budget laws: update RULES and RULES_CHECKED_AT every year. Everything here is an
 * estimate: per-taxpayer income limits (over 75,000 €) and incapienza aren't modelled.
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
  | "mutuo";

type Rule = {
  label: string;
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
};

export const RULES: Record<DeductionType, Rule> = {
  sanitarie: {
    label: "Spese sanitarie",
    rate: 0.19,
    franchigia: 129.11,
    traceable: true,
    documents:
      "Scontrino parlante o fattura con il tuo codice fiscale; per le visite private anche la prova del pagamento con carta o bonifico.",
    note: "Farmaci, dispositivi medici e prestazioni del Servizio sanitario valgono anche se pagati in contanti.",
  },
  veterinarie: {
    label: "Spese veterinarie",
    rate: 0.19,
    franchigia: 129.11,
    cap: 550,
    traceable: true,
    documents: "Fattura del veterinario e scontrino parlante per i farmaci dell'animale.",
  },
  istruzione: {
    label: "Scuola dei figli",
    rate: 0.19,
    cap: 800,
    perChild: true,
    traceable: true,
    documents: "Ricevute di rette, mensa, gite e contributi scolastici intestate a te o al figlio.",
    note: "Dall'infanzia alle superiori; il limite vale per ogni figlio.",
  },
  sport: {
    label: "Sport dei figli (5-18 anni)",
    rate: 0.19,
    cap: 210,
    perChild: true,
    traceable: true,
    documents: "Ricevuta della società sportiva o della palestra con i dati del ragazzo.",
  },
  asilo: {
    label: "Asilo nido",
    rate: 0.19,
    cap: 632,
    perChild: true,
    traceable: true,
    documents: "Ricevute delle rette del nido.",
    note: "Non si somma al bonus asilo nido INPS per le stesse rette.",
  },
  trasporto: {
    label: "Abbonamenti ai mezzi pubblici",
    rate: 0.19,
    cap: 250,
    traceable: true,
    documents:
      "L'abbonamento nominativo e la prova del pagamento. I biglietti singoli non valgono.",
  },
  assicurazione: {
    label: "Assicurazioni vita e infortuni",
    rate: 0.19,
    cap: 530,
    traceable: true,
    documents: "L'attestazione dei premi pagati che rilascia la compagnia.",
    note: "Solo la parte che copre morte o invalidità permanente, non casa o auto.",
  },
  mutuo: {
    label: "Interessi del mutuo prima casa",
    rate: 0.19,
    cap: 4000,
    traceable: true,
    documents: "La certificazione degli interessi pagati che invia la banca.",
    note: "Solo gli interessi, non la quota di capitale della rata.",
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

function summarizeType(type: DeductionType, lines: DeductionLine[], children: number): TypeSummary {
  const rule = RULES[type];
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
export function summarizeDeductions(inputs: DeductionInput[], children: number): DeductionsSummary {
  return summarizeLines(
    inputs.map(classifyDeduction).filter((l) => l.type !== null || l.source === "manual"),
    children,
  );
}

/** Totals for lines already classified (e.g. only one person's, for the dossier). */
export function summarizeLines(lines: DeductionLine[], children: number): DeductionsSummary {
  const memberIds = Array.from(new Set(lines.map((l) => l.memberId)));
  const members = memberIds.map((memberId) => {
    const own = lines.filter((l) => l.memberId === memberId);
    const byType = DEDUCTION_TYPES.map((t) => summarizeType(t, own, children)).filter(
      (t) => t.eligible > 0 || t.lostToCash > 0,
    );
    return { memberId, refund: cents(byType.reduce((s, t) => s + t.refund, 0)), byType };
  });

  const byType = DEDUCTION_TYPES.map((type) => {
    const parts = members.flatMap((m) => m.byType.filter((t) => t.type === type));
    const one = summarizeType(type, [], children);
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
export function refundOf(amount: number, type: DeductionType) {
  return cents(amount * RULES[type].rate);
}
