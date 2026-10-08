/*
 * "Il patto": a bet against yourself. A spending limit on a category until the end of a month,
 * a stake (a friend who referees, a promise, a fine into a savings goal) and FinTrack checking
 * the movements at the end. The stake is only social: FinTrack never moves money.
 */

const DAY_MS = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (time: number) => new Date(time).toISOString().slice(0, 10);
const cents = (n: number) => Math.round(n * 100) / 100;

/** A few at a time: a pact works because it's the one thing to keep in mind. */
export const MAX_ACTIVE_PACTS = 3;
/** The referee's link keeps working this long after the end, to see how it went. */
export const LINK_DAYS_AFTER = 30;
export const PROMISE_MAX = 120;
export const REFEREE_MAX = 40;

export const PACT_STARTS = ["now", "next-month"] as const;
export type PactStart = (typeof PACT_STARTS)[number];

/** From today to the end of this month, or the whole of next month. `today` is "YYYY-MM-DD". */
export function pactPeriod(start: PactStart, today: string) {
  const [year, month] = today.split("-").map(Number);
  if (start === "now") {
    return { from: today, to: toIso(Date.UTC(year, month, 0)) };
  }
  return { from: toIso(Date.UTC(year, month, 1)), to: toIso(Date.UTC(year, month + 1, 0)) };
}

export const linkExpiry = (to: string) => toIso(toTime(to) + LINK_DAYS_AFTER * DAY_MS);

export type PactState = "upcoming" | "active" | "won" | "lost";

export type PactStatus = {
  state: PactState;
  /** Share of the limit already spent (can pass 1). */
  used: number;
  /** Share of the period gone by, today included (0 before it starts, 1 after). */
  elapsed: number;
  /** Days left, today included; 0 once over. */
  daysLeft: number;
  /** At this pace, what the period will end at; null when it's too early to say or over. */
  projected: number | null;
  /** The limit is gone: the pact is lost even before the end. */
  over: number;
};

/**
 * Where a pact stands on `today`. Over the limit it's lost straight away: spending only adds up.
 * Before the end it's "active"; after, won or lost on what was recorded.
 */
export function pactStatus(input: {
  limit: number;
  from: string;
  to: string;
  spent: number;
  today: string;
}): PactStatus {
  const total = (toTime(input.to) - toTime(input.from)) / DAY_MS + 1;
  const gone = Math.min(
    total,
    Math.max(0, (toTime(input.today) - toTime(input.from)) / DAY_MS + 1),
  );
  const used = input.limit > 0 ? input.spent / input.limit : 0;
  const over = cents(Math.max(0, input.spent - input.limit));
  let state: PactState;
  if (over > 0) state = "lost";
  else if (input.today < input.from) state = "upcoming";
  else if (input.today <= input.to) state = "active";
  else state = "won";
  // Three days in, a pace means something; before, a single dinner would look like a disaster.
  const projected = state === "active" && gone >= 3 ? cents((input.spent / gone) * total) : null;
  return {
    state,
    used,
    elapsed: gone / total,
    daysLeft: input.today < input.from ? total : input.today > input.to ? 0 : total - gone + 1,
    projected,
    over,
  };
}

/** How the user has done so far: pacts kept out of the ones that are over. */
export function trackRecord(states: PactState[]) {
  const done = states.filter((s) => s === "won" || s === "lost");
  return { kept: done.filter((s) => s === "won").length, total: done.length };
}
