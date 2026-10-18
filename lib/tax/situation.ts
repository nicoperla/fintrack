/*
 * "Chi sei": six questions about the income year, and what they mean for the 730. The answers
 * decide the traffic light (alone in 15 minutes / alone with a few changes / better with a CAF),
 * whether filing is compulsory and which documents to prepare. Orbitly informs: these are general
 * rules, the last word is the Agenzia's (or the CAF's).
 */

export const WORK_KINDS = ["employee", "pensioner", "both", "none"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];
export const WORK_LABELS: Record<WorkKind, string> = {
  employee: "Lavoro dipendente",
  pensioner: "Pensione",
  both: "Tutti e due",
  none: "Né lavoro né pensione a fine anno",
};

export const HOMES = ["mortgage", "owner", "rent", "family"] as const;
export type Home = (typeof HOMES)[number];
export const HOME_LABELS: Record<Home, string> = {
  mortgage: "Di proprietà, con il mutuo",
  owner: "Di proprietà, senza mutuo",
  rent: "In affitto",
  family: "Dai genitori o ospite",
};

export const OTHER_INCOMES = ["rent-income", "occasional", "foreign", "crypto", "vat"] as const;
export type OtherIncome = (typeof OTHER_INCOMES)[number];
export const OTHER_INCOME_LABELS: Record<OtherIncome, string> = {
  "rent-income": "Affitti incassati da una casa che dai in affitto",
  occasional: "Lavoretti o prestazioni occasionali",
  foreign: "Conti o investimenti all'estero",
  crypto: "Criptovalute",
  vat: "Partita IVA",
};

export const LIFE_EVENTS = [
  "married",
  "separated",
  "child",
  "house",
  "moved",
  "renovation",
  "death",
] as const;
export type LifeEvent = (typeof LIFE_EVENTS)[number];
export const LIFE_EVENT_LABELS: Record<LifeEvent, string> = {
  married: "Matrimonio o unione civile",
  separated: "Separazione o divorzio",
  child: "Nascita o adozione di un figlio",
  house: "Acquisto della casa",
  moved: "Trasferimento per lavoro",
  renovation: "Lavori in casa",
  death: "Lutto in famiglia",
};

export type Situation = {
  work: WorkKind | null;
  /** More than one employer or pension during the year (more than one CU). */
  moreEmployers: boolean;
  /** Someone pays a salary or pension in July: they make the refund or withhold the debt. */
  agent: boolean | null;
  home: Home | null;
  spouse: boolean;
  /** Dependent children aged 21–30 (or disabled from 21): younger ones get the Assegno unico. */
  children: number;
  /** The share of the children's deduction: 50 split with the other parent, 100 for one. */
  childrenShare: 50 | 100;
  /** Parents living with you and dependent on you. */
  parents: number;
  /** A dependent child is earning close to the limit (4.000 € under 24). */
  childIncomeRisk: boolean;
  otherIncome: OtherIncome[];
  events: LifeEvent[];
  answeredAt: string | null;
};

export const EMPTY_SITUATION: Situation = {
  work: null,
  moreEmployers: false,
  agent: null,
  home: null,
  spouse: false,
  children: 0,
  childrenShare: 50,
  parents: 0,
  childIncomeRisk: false,
  otherIncome: [],
  events: [],
  answeredAt: null,
};

const pick = <T extends string>(list: readonly T[], v: unknown): T | null =>
  list.includes(v as T) ? (v as T) : null;
const count = (v: unknown, max: number) =>
  typeof v === "number" && Number.isInteger(v) ? Math.min(max, Math.max(0, v)) : 0;
const listOf = <T extends string>(list: readonly T[], v: unknown): T[] =>
  Array.isArray(v) ? list.filter((item) => v.includes(item)) : [];

/** The answers as stored (JSON), with anything unexpected dropped. */
export function readSituation(raw: unknown): Situation {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    work: pick(WORK_KINDS, o.work),
    moreEmployers: o.moreEmployers === true,
    agent: typeof o.agent === "boolean" ? o.agent : null,
    home: pick(HOMES, o.home),
    spouse: o.spouse === true,
    children: count(o.children, 10),
    childrenShare: o.childrenShare === 100 ? 100 : 50,
    parents: count(o.parents, 4),
    childIncomeRisk: o.childIncomeRisk === true,
    otherIncome: listOf(OTHER_INCOMES, o.otherIncome),
    events: listOf(LIFE_EVENTS, o.events),
    answeredAt: typeof o.answeredAt === "string" ? o.answeredAt : null,
  };
}

export const isAnswered = (s: Situation) => s.answeredAt !== null && s.work !== null;

/** Nobody pays a salary or pension in July: the Agenzia refunds, and a debt is paid with an F24. */
export const withoutAgent = (s: Situation) => s.work === "none" || s.agent === false;

export type Light = "green" | "yellow" | "red";

export type Assessment = {
  light: Light;
  title: string;
  /** One line each: why the light is this colour. */
  reasons: string[];
  /** Whether the 730 (or another return) has to be filed. */
  obligation: { state: "no" | "maybe" | "yes"; text: string };
  /** The refund comes from the Agenzia, not in the pay or pension. */
  noAgent: boolean;
  /** With a partita IVA the 730 can't be used. */
  vat: boolean;
};

/**
 * The traffic light. Red: better with a CAF or a professional (or a different return). Yellow:
 * fine alone, with a few changes Orbitly points out. Green: the precompilato is likely complete.
 * `seenRefund`: what the deductions Orbitly saw are worth, to say whether filing pays off.
 */
export function assess(s: Situation, seenRefund: number): Assessment | null {
  if (!isAnswered(s)) return null;
  const noAgent = withoutAgent(s);
  const vat = s.otherIncome.includes("vat");
  if (vat) {
    return {
      light: "red",
      title: "Con la partita IVA serve il modello Redditi",
      reasons: [
        "Chi ha la partita IVA non può usare il 730: si presenta il modello Redditi, di solito con il commercialista.",
        "Orbitly ti aiuta lo stesso con le spese detraibili e i documenti da portare.",
      ],
      obligation: {
        state: "yes",
        text: "Sì: con la partita IVA la dichiarazione va sempre fatta.",
      },
      noAgent,
      vat,
    };
  }

  const red: string[] = [];
  const yellow: string[] = [];
  if (s.otherIncome.includes("foreign")) {
    red.push(
      "Conti e investimenti all'estero vanno dichiarati anche senza guadagni (quadro W): meglio farsi aiutare.",
    );
  }
  if (s.otherIncome.includes("crypto")) {
    red.push(
      "Le criptovalute vanno indicate nel quadro W e, se hai guadagnato, nel quadro T: meglio farsi aiutare.",
    );
  }
  if (s.events.includes("death")) {
    red.push(
      "Un lutto in famiglia porta eredità, immobili e a volte il 730 della persona scomparsa: un CAF ti segue meglio.",
    );
  }
  if (s.events.includes("separated")) {
    red.push(
      "Con una separazione cambiano assegni, figli a carico e casa: conviene un CAF o un professionista.",
    );
  }
  if (s.moreEmployers) {
    yellow.push(
      "Con più datori di lavoro ognuno ha calcolato le tasse come se fosse l'unico: il 730 spesso è a debito.",
    );
  }
  if (s.otherIncome.includes("rent-income")) {
    yellow.push("Controlla che il precompilato abbia gli affitti che incassi (quadro B).");
  }
  if (s.otherIncome.includes("occasional")) {
    yellow.push("I compensi per lavoro occasionale vanno aggiunti se mancano (quadro D).");
  }
  if (s.home === "rent") {
    yellow.push("La detrazione per l'affitto nel precompilato di solito manca: te la calcolo io.");
  }
  if (s.events.includes("house")) {
    yellow.push(
      "Casa comprata: controlla gli interessi del mutuo e il compenso dell'agenzia (fino a 1.000 €).",
    );
  }
  if (s.events.includes("renovation")) {
    yellow.push("Lavori in casa: la rata del bonus va controllata ogni anno per dieci anni.");
  }
  if (s.events.includes("moved")) {
    yellow.push("Trasferito per lavoro: c'è una detrazione per l'affitto più alta, per tre anni.");
  }
  if (s.events.includes("married") || s.events.includes("child")) {
    yellow.push("La famiglia è cambiata: controlla i familiari a carico nel precompilato.");
  }
  if (s.children > 0 || s.parents > 0 || s.spouse) {
    yellow.push("Controlla i familiari a carico: codici fiscali, mesi e percentuali.");
  }

  const obligation = obligationOf(s, seenRefund, noAgent);
  if (red.length) {
    return {
      light: "red",
      title: "Ti conviene un CAF o un professionista",
      reasons: [...red, ...yellow],
      obligation,
      noAgent,
      vat,
    };
  }
  if (yellow.length) {
    return {
      light: "yellow",
      title: "Puoi fare da solo, con qualche modifica: ti dico io dove",
      reasons: yellow,
      obligation,
      noAgent,
      vat,
    };
  }
  return {
    light: "green",
    title: "Puoi fare da solo in un quarto d'ora",
    reasons: [
      "Un solo datore di lavoro o una sola pensione e nessuna entrata in più: il precompilato di solito ha già tutto.",
    ],
    obligation,
    noAgent,
    vat,
  };
}

function obligationOf(
  s: Situation,
  seenRefund: number,
  noAgent: boolean,
): Assessment["obligation"] {
  const extra = s.otherIncome.filter((i) => i !== "vat");
  if (extra.length) {
    return {
      state: "yes",
      text: "Sì: affitti incassati, lavori occasionali, conti all'estero e cripto vanno dichiarati.",
    };
  }
  if (s.moreEmployers) {
    return {
      state: "maybe",
      text: "Probabilmente sì: con più CU nello stesso anno di solito va fatto. Non serve se l'ultimo datore di lavoro ha già conguagliato anche i redditi precedenti (lo vedi nella CU).",
    };
  }
  if (s.events.includes("death")) {
    return {
      state: "maybe",
      text: "Dipende: chi eredita un immobile o dei redditi spesso deve dichiararli. Chiedi a un CAF.",
    };
  }
  const worth =
    seenRefund > 0
      ? ` Ti conviene: con le spese che ho visto ti tornano circa ${Math.round(seenRefund)} €.`
      : " Ti conviene se hai spese da detrarre o paghi l'affitto.";
  return {
    state: "no",
    text: `Non sei obbligato: ${noAgent ? "senza redditi da dichiarare non serve" : "la busta paga o la pensione hanno già fatto i conti"}.${worth}`,
  };
}
