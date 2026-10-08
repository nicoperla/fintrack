/*
 * "Mio, tuo, nostro": in a shared space, the shared money is everyone's; each member's personal
 * space stays theirs. What crosses over is only what its owner chooses to show, item by item,
 * as totals: never accounts, movements or names of shops. Off by default, revocable any time.
 */

export const SHARE_ITEMS = ["balance", "savings", "investments", "goals"] as const;
export type ShareItem = (typeof SHARE_ITEMS)[number];

export const SHARE_LABELS: Record<ShareItem, { title: string; text: string }> = {
  balance: {
    title: "Il saldo dei conti personali",
    text: "Quanto c'è oggi sui conti del tuo spazio, risparmi compresi. Un numero solo.",
  },
  savings: {
    title: "Quanto metti da parte",
    text: "Entrate meno uscite dell'ultimo mese finito, in euro e in percentuale.",
  },
  investments: {
    title: "Il valore degli investimenti",
    text: "Il totale di oggi, senza dire in cosa.",
  },
  goals: {
    title: "I tuoi obiettivi",
    text: "Nome e percentuale raggiunta, senza le cifre.",
  },
};

/** What a personal space adds up to. Each field is null when there's nothing to show for it. */
export type PersonalSummary = {
  currency: string;
  balance: number | null;
  savings: { month: string; saved: number; rate: number | null } | null;
  investments: number | null;
  goals: { name: string; progress: number }[] | null;
};

/** Only the known items, each once, in the usual order. */
export function readShares(raw: readonly string[]): ShareItem[] {
  return SHARE_ITEMS.filter((item) => raw.includes(item));
}

/**
 * The part of a summary its owner chose to show; everything else becomes null. This is the only
 * way a personal space's figures reach another space.
 */
export function pickShared(summary: PersonalSummary, shares: readonly string[]): PersonalSummary {
  const allowed = new Set(readShares(shares));
  return {
    currency: summary.currency,
    balance: allowed.has("balance") ? summary.balance : null,
    savings: allowed.has("savings") ? summary.savings : null,
    investments: allowed.has("investments") ? summary.investments : null,
    goals: allowed.has("goals") ? summary.goals : null,
  };
}
