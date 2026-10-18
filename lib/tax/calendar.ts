import type { YearRules } from "@/lib/tax/rules";

/*
 * The 730 year, from the first expense to the money back: five stages tied to the real calendar,
 * when the refund arrives, which correction is still possible and the next thing to do.
 */

export type Stage = "year" | "prepare" | "precompiled" | "send" | "after";

export const STAGES: readonly Stage[] = ["year", "prepare", "precompiled", "send", "after"];

export const STAGE_LABELS: Record<Stage, string> = {
  year: "Tutto l'anno",
  prepare: "Preparazione",
  precompiled: "Il precompilato",
  send: "L'invio",
  after: "Dopo l'invio",
};

export const MONTHS = [
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
] as const;

const dayFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
/** "30 aprile". */
export const longDay = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00Z`));

/**
 * The income year to show: from October the new year's 730 starts taking shape (the season just
 * closed with the deadline of 30 September); until September it's last year's, being filed.
 */
export function defaultTaxYear(today: { year: number; month: number }) {
  // `month` is 0-based, as in todayInAppTimeZone(): 9 is October.
  return today.month >= 9 ? today.year : today.year - 1;
}

export function stageOf(rules: YearRules, today: string, sentAt: string | null): Stage {
  if (today <= `${rules.year}-12-31`) return "year";
  if (sentAt) return "after";
  const c = rules.calendar;
  if (today < c.precompiled) return "prepare";
  if (today < c.sendFrom) return "precompiled";
  if (today <= c.deadline) return "send";
  return "after";
}

/** The stages with their dates, for the timeline. */
export function timeline(rules: YearRules) {
  const y = rules.year;
  const c = rules.calendar;
  return [
    {
      stage: "year" as const,
      when: `gennaio – dicembre ${y}`,
      text: "Registri le spese, io raccolgo quelle detraibili e ti avviso quando serve.",
    },
    {
      stage: "prepare" as const,
      when: `gennaio – aprile ${y + 1}`,
      text: `Arriva la CU (entro il ${longDay(c.cu)}), prepari i documenti e vedi una prima stima.`,
    },
    {
      stage: "precompiled" as const,
      when: `dal ${longDay(c.precompiled)} ${y + 1}`,
      text: "Esce il precompilato: lo apriamo insieme e lo confrontiamo riga per riga.",
    },
    {
      stage: "send" as const,
      when: `${longDay(c.sendFrom)} – ${longDay(c.deadline)} ${y + 1}`,
      text: "Lo invii da solo, oppure vai al CAF con tutto pronto.",
    },
    {
      stage: "after" as const,
      when: `luglio ${y + 1} – marzo ${y + 2}`,
      text: "Ti dico quando arriva il rimborso, cosa ti tratterranno e cosa conservare.",
    },
  ];
}

export type Payer = "employee" | "pensioner" | "agency";

export type RefundTiming =
  | { kind: "pay"; from: number; to: number; year: number; payer: "employee" | "pensioner" }
  | { kind: "agency"; by: string };

/**
 * When the refund arrives (or the debt is taken) for a 730 sent on `sentAt`: in the pay or
 * pension of a month that depends on the date, or from the Agenzia, between December and six
 * months after the deadline, for whoever has nobody paying them in July.
 */
export function refundTiming(rules: YearRules, sentAt: string, payer: Payer): RefundTiming {
  if (payer === "agency") return { kind: "agency", by: `${rules.year + 2}-03-31` };
  const slot =
    rules.refunds.find((r) => sentAt <= r.sentBy) ?? rules.refunds[rules.refunds.length - 1];
  const [from, to] = payer === "pensioner" ? slot.pensioner : slot.employee;
  return { kind: "pay", from, to, year: rules.year + 1, payer };
}

export function describeTiming(t: RefundTiming) {
  if (t.kind === "agency") {
    return `te lo paga l'Agenzia delle Entrate sul conto, di solito da dicembre ed entro il ${longDay(t.by)} ${t.by.slice(0, 4)}`;
  }
  const where = t.payer === "pensioner" ? "nella pensione" : "nella busta paga";
  const months =
    t.from === t.to
      ? `di ${MONTHS[t.from - 1]}`
      : `tra ${MONTHS[t.from - 1]} e ${MONTHS[t.to - 1]}`;
  return `${where} ${months} ${t.year}`;
}

/** The latest date to send for each refund month still reachable from `today`. */
export function sendDeadlines(rules: YearRules, today: string, payer: Payer) {
  if (payer === "agency") return [];
  return rules.refunds
    .filter((r) => r.sentBy >= today)
    .map((r) => ({ sentBy: r.sentBy, timing: refundTiming(rules, r.sentBy, payer) }));
}

export type Correction =
  /** Cancel the 730 sent alone (once) and send it again. */
  | { kind: "annul"; by: string }
  /** 730 integrativo, through a CAF or a professional, only if in your favour. */
  | { kind: "integrative"; by: string }
  /** Modello Redditi correttivo or integrativo, with a CAF or a professional. */
  | { kind: "redditi" };

/** The ways to fix a 730 already sent that are still open on `today`. */
export function correctionPaths(
  rules: YearRules,
  today: string,
  channel: "SELF" | "CAF" | null,
): Correction[] {
  const c = rules.calendar;
  const paths: Correction[] = [];
  if (channel !== "CAF" && today <= c.annulBy) paths.push({ kind: "annul", by: c.annulBy });
  if (today <= c.integrativeBy) paths.push({ kind: "integrative", by: c.integrativeBy });
  paths.push({ kind: "redditi" });
  return paths;
}

/**
 * Receipts and the 730 itself are kept until 31 December of the fifth year after filing: the
 * time the Agenzia has to check them.
 */
export const keepUntil = (incomeYear: number) => `${incomeYear + 6}-12-31`;

/** The income years whose papers can be thrown away on `today` (the last one, at least). */
export function disposableYear(today: string) {
  return Number(today.slice(0, 4)) - 7;
}

/**
 * The money a sent 730 moves, for the forecast: the refund (until it's marked as arrived) or the
 * debt in the pay of the expected month, and the second advance in November. `payday`: the day
 * the salary or pension arrives.
 */
export function expected730Events(input: {
  rules: YearRules;
  sentAt: string;
  payer: Payer;
  result: number;
  refundReceived: boolean;
  secondAdvance: number | null;
  payday: number;
}) {
  const { rules, payer } = input;
  const filing = rules.year + 1;
  const day = String(Math.min(28, Math.max(1, input.payday))).padStart(2, "0");
  const events: { date: string; name: string; amount: number }[] = [];
  const timing = refundTiming(rules, input.sentAt, payer);
  if (input.result > 0 && !input.refundReceived) {
    events.push({
      date:
        timing.kind === "agency"
          ? `${filing}-12-${day}`
          : `${timing.year}-${String(timing.from).padStart(2, "0")}-${day}`,
      name: "Rimborso del 730",
      amount: input.result,
    });
  }
  if (input.result < 0 && timing.kind === "pay") {
    events.push({
      date: `${timing.year}-${String(timing.from).padStart(2, "0")}-${day}`,
      name: "Trattenuta del 730",
      amount: input.result,
    });
  }
  if (input.secondAdvance && input.secondAdvance > 0) {
    events.push({
      date: payer === "agency" ? `${filing}-11-30` : `${filing}-11-${day}`,
      name: "Secondo acconto IRPEF",
      amount: -input.secondAdvance,
    });
  }
  return events;
}
