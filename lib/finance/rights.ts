import { DEDUCTION_TYPES, RULES, type DeductionType } from "@/lib/finance/deductions";

/*
 * "Radar dei diritti": what the 730 precompilato misses compared with the expenses FinTrack saw,
 * the rent deduction (rarely precompiled) and the company welfare about to be lost.
 *
 * Rent: art. 16 TUIR, for the 730/2026 and 730/2027. Fringe benefits: art. 51 c. 3 TUIR as set by
 * L. 207/2024 for 2025–2027. Checked October 2026. FinTrack informs: the 730 is corrected by the
 * user or by a CAF, and every figure here is an estimate.
 */

const cents = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

// ---------- The user's tax profile ----------

export const INCOME_BANDS = ["fino-15k", "fino-31k", "oltre"] as const;
export type IncomeBand = (typeof INCOME_BANDS)[number];

export const INCOME_BAND_LABELS: Record<IncomeBand, string> = {
  "fino-15k": "Fino a 15.493,71 €",
  "fino-31k": "Da 15.493,72 a 30.987,41 €",
  oltre: "Oltre 30.987,41 €",
};

export const RENT_CONTRACTS = ["libero", "concordato"] as const;
export type RentContract = (typeof RENT_CONTRACTS)[number];

export const RENT_CONTRACT_LABELS: Record<RentContract, string> = {
  libero: "Canone libero (4+4)",
  concordato: "Canone concordato (3+2)",
};

/** Saved per person in `users.tax_profile`: the 730 is everyone's own. */
export type TaxProfile = {
  /** Reddito complessivo of the year, by band: it decides rent deductions. */
  incomeBand: IncomeBand | null;
  birthYear: number | null;
  rent: {
    /** The contract of the home the user lives in; null: not renting. */
    contract: RentContract | null;
    /** The year the contract started: the deduction for the young lasts four years. */
    since: number | null;
    /** Moved for work in the last three years. */
    transferred: boolean;
  };
  welfare: {
    /** Credit left on the company welfare platform. */
    balance: number | null;
    expiresOn: string | null;
    /** Fringe benefits received this year (vouchers, bills or rent paid by the employer). */
    fringe: number | null;
    fringeYear: number | null;
  };
};

export const EMPTY_TAX_PROFILE: TaxProfile = {
  incomeBand: null,
  birthYear: null,
  rent: { contract: null, since: null, transferred: false },
  welfare: { balance: null, expiresOn: null, fringe: null, fringeYear: null },
};

// ---------- Rent ----------

/** Yearly amounts of art. 16 TUIR; they're proportioned to the months the home was rented. */
export const RENT_RULES = {
  lowIncome: 15_493.71,
  midIncome: 30_987.41,
  libero: { low: 300, mid: 150 },
  concordato: { low: 495.8, mid: 247.9 },
  transferred: { low: 991.6, mid: 495.8 },
  young: { rate: 0.2, min: 991.6, max: 2000, fromAge: 20, toAge: 31, years: 4 },
} as const;

export type RentKind = "young" | "transferred" | "concordato" | "libero";

/** The type to write in the 730, quadro E, rigo E71. */
export const RENT_CODES: Record<RentKind, number> = {
  libero: 1,
  concordato: 2,
  transferred: 3,
  young: 4,
};

export type RentDeduction =
  | {
      amount: number;
      kind: RentKind;
      code: number;
      label: string;
      /** Months counted: the ones with rent among the movements, or the whole year. */
      months: number;
    }
  | { amount: 0; reason: string };

/**
 * The rent deduction due for a year: the best of the ones the user is entitled to (they can't be
 * added together). `rentPaid` and `months` come from the movements categorized as rent.
 */
export function rentDeduction(input: {
  year: number;
  profile: TaxProfile;
  rentPaid: number;
  months: number;
}): RentDeduction {
  const { year, profile } = input;
  const { contract, since, transferred } = profile.rent;
  if (!contract) {
    return {
      amount: 0,
      reason: "Dimmi se paghi l'affitto della casa dove vivi, e con che contratto.",
    };
  }
  if (!profile.incomeBand) {
    return { amount: 0, reason: "Scegli la fascia del tuo reddito: gli importi dipendono da lì." };
  }
  if (profile.incomeBand === "oltre") {
    return {
      amount: 0,
      reason:
        "Con un reddito complessivo oltre 30.987,41 € la detrazione per l'affitto non spetta.",
    };
  }
  const low = profile.incomeBand === "fino-15k";
  const months = input.months > 0 ? Math.min(12, input.months) : 12;
  const share = months / 12;
  const candidates: { kind: RentKind; amount: number; label: string }[] = [
    {
      kind: contract,
      amount: (low ? RENT_RULES[contract].low : RENT_RULES[contract].mid) * share,
      label:
        contract === "concordato" ? "Contratto a canone concordato" : "Contratto a canone libero",
    },
  ];
  if (transferred) {
    candidates.push({
      kind: "transferred",
      amount: (low ? RENT_RULES.transferred.low : RENT_RULES.transferred.mid) * share,
      label: "Trasferito per lavoro negli ultimi tre anni",
    });
  }
  const age = profile.birthYear ? year - profile.birthYear : null;
  const { young } = RENT_RULES;
  if (
    low &&
    age !== null &&
    age >= young.fromAge &&
    age <= young.toAge &&
    since !== null &&
    year >= since &&
    year < since + young.years
  ) {
    candidates.push({
      kind: "young",
      amount: Math.min(young.max, Math.max(young.min * share, input.rentPaid * young.rate)),
      label: "Giovani tra 20 e 31 anni: il 20% dell'affitto, da 991,60 a 2.000 €",
    });
  }
  const best = candidates.sort((a, b) => b.amount - a.amount)[0];
  return {
    amount: cents(best.amount),
    kind: best.kind,
    code: RENT_CODES[best.kind],
    label: best.label,
    months,
  };
}

// ---------- The precompilato ----------

/** The refund an amount of expenses brings, after the type's franchigia and limit. */
export function refundFor(type: DeductionType, amount: number, children: number) {
  const rule = RULES[type];
  const cap =
    rule.cap === undefined ? Infinity : rule.cap * (rule.perChild ? Math.max(1, children) : 1);
  return cents(Math.max(0, Math.min(amount, cap) - (rule.franchigia ?? 0)) * rule.rate);
}

export type ComparisonRow = {
  type: DeductionType;
  label: string;
  fintrack: number;
  precompiled: number;
  /** Seen by FinTrack and not in the precompilato (at least this much). */
  missing: number;
  extraRefund: number;
};

/**
 * FinTrack's expenses against the totals the user reads in the precompilato. Where FinTrack saw
 * more, at least the difference is missing; where it saw less, the precompilato wins.
 */
export function compareWithPrecompiled(input: {
  fintrack: Partial<Record<DeductionType, number>>;
  precompiled: Partial<Record<DeductionType, number>>;
  children: number;
  /** The rent deduction due, and whether the precompilato already has it. */
  rent: { amount: number; inPrecompiled: boolean } | null;
}) {
  const rows: ComparisonRow[] = DEDUCTION_TYPES.map((type) => {
    const fintrack = cents(input.fintrack[type] ?? 0);
    const precompiled = cents(input.precompiled[type] ?? 0);
    const extraRefund = cents(
      refundFor(type, Math.max(fintrack, precompiled), input.children) -
        refundFor(type, precompiled, input.children),
    );
    return {
      type,
      label: RULES[type].label,
      fintrack,
      precompiled,
      missing: cents(Math.max(0, fintrack - precompiled)),
      extraRefund,
    };
  });
  const rentExtra =
    input.rent && !input.rent.inPrecompiled ? cents(Math.max(0, input.rent.amount)) : 0;
  return {
    rows,
    rentExtra,
    extraRefund: cents(rows.reduce((s, r) => s + r.extraRefund, 0) + rentExtra),
    missingTotal: cents(rows.reduce((s, r) => s + r.missing, 0)),
  };
}

// ---------- Company welfare ----------

/** Fringe benefits are tax-free up to here; above it, all of them are taxed (2025–2027). */
export const FRINGE_LIMITS = { base: 1000, withChildren: 2000 } as const;

export function fringeStatus(
  welfare: TaxProfile["welfare"],
  dependentChildren: number,
  year: number,
) {
  const limit = dependentChildren > 0 ? FRINGE_LIMITS.withChildren : FRINGE_LIMITS.base;
  // Last year's figure doesn't count against this year's limit.
  const used = welfare.fringeYear === year ? welfare.fringe : null;
  if (used === null) return { limit, used: null, left: limit, state: "unknown" as const };
  return {
    limit,
    used,
    left: cents(Math.max(0, limit - used)),
    state:
      used > limit ? ("over" as const) : used >= limit * 0.9 ? ("near" as const) : ("ok" as const),
  };
}

/** Days left to use the welfare credit, null without a credit or a date. */
export function welfareDeadline(welfare: TaxProfile["welfare"], today: string) {
  if (!welfare.balance || welfare.balance <= 0 || !welfare.expiresOn) return null;
  const days = daysBetween(today, welfare.expiresOn);
  return {
    balance: welfare.balance,
    expiresOn: welfare.expiresOn,
    days,
    state: days < 0 ? ("expired" as const) : days <= 30 ? ("soon" as const) : ("ok" as const),
  };
}

// ---------- Reading the profile ----------

const isBand = (v: unknown): v is IncomeBand => INCOME_BANDS.includes(v as IncomeBand);
const isContract = (v: unknown): v is RentContract => RENT_CONTRACTS.includes(v as RentContract);
const numberOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const isoOrNull = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

/** The profile as stored (JSON), with anything unexpected dropped. */
export function readTaxProfile(raw: unknown): TaxProfile {
  const o = (raw ?? {}) as Record<string, unknown>;
  const rent = (o.rent ?? {}) as Record<string, unknown>;
  const welfare = (o.welfare ?? {}) as Record<string, unknown>;
  return {
    incomeBand: isBand(o.incomeBand) ? o.incomeBand : null,
    birthYear: numberOrNull(o.birthYear),
    rent: {
      contract: isContract(rent.contract) ? rent.contract : null,
      since: numberOrNull(rent.since),
      transferred: rent.transferred === true,
    },
    welfare: {
      balance: numberOrNull(welfare.balance),
      expiresOn: isoOrNull(welfare.expiresOn),
      fringe: numberOrNull(welfare.fringe),
      fringeYear: numberOrNull(welfare.fringeYear),
    },
  };
}
