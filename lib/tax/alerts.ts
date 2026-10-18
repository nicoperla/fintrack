import { RULES, type DeductionsSummary, type DeductionType } from "@/lib/finance/deductions";
import type { Situation } from "@/lib/tax/situation";

/*
 * "Il mio 730": the alerts at the right moment. Some show up while recording an expense
 * (lib/transactions/save.ts: franchigia passed, limit reached, paid in cash), all of them on the
 * page and the most urgent in the weekly summary.
 */

export type TaxAlert = {
  key: string;
  tone: "warn" | "good" | "info";
  title: string;
  text: string;
  /** Where to act on it, when it's another page. */
  href?: string;
};

const cents = (n: number) => Math.round(n * 100) / 100;
const eur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

/**
 * Salaries from different payers in the same year: each one withheld tax as if it were the only
 * one, so the 730 usually ends up owing. `incomes`: the year's salary movements.
 */
export function distinctPayers(incomes: { description: string; amount: number }[]) {
  const STOP = new Set([
    ...["stipendio", "busta", "paga", "salario", "mensilita", "tredicesima", "quattordicesima"],
    ...["accredito", "bonifico", "emolumenti", "competenze", "netto", "mese", "anno"],
    ...["della", "dello", "degli", "srl", "spa", "snc", "sas", "spa"],
    ...["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto"],
    ...["settembre", "ottobre", "novembre", "dicembre", "gen", "feb", "mar", "apr", "mag"],
    ...["giu", "lug", "ago", "set", "ott", "nov", "dic"],
  ]);
  // "Stipendio ACME S.r.l. ottobre" and "Accredito stipendio Acme srl" are the same payer: "acme".
  const key = (d: string) =>
    d
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z]+/g, " ")
      .split(" ")
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .slice(0, 2)
      .join(" ");
  const payers = new Map<string, number>();
  for (const i of incomes) {
    const k = key(i.description);
    if (k.length < 3) continue;
    payers.set(k, (payers.get(k) ?? 0) + i.amount);
  }
  // A payer seen once with a small amount is a refund or a bonus, not a job.
  return Array.from(payers.entries())
    .filter(([, total]) => total >= 1000)
    .map(([name]) => name);
}

export function taxAlerts(input: {
  year: number;
  today: string;
  summary: DeductionsSummary;
  situation: Situation;
  /** Distinct salary payers seen in the year (distinctPayers). */
  payers: string[];
  children: number;
}): TaxAlert[] {
  const { summary, situation: s, year, today } = input;
  const alerts: TaxAlert[] = [];
  const inYear = today <= `${year}-12-31`;

  if (s.moreEmployers || input.payers.length >= 2) {
    alerts.push({
      key: "two-employers",
      tone: "warn",
      title: "Due stipendi nello stesso anno: a luglio potresti dover pagare",
      text: "Ogni datore di lavoro ha calcolato le tasse come se fosse l'unico. Il 730 rimette insieme i redditi e spesso risulta un debito, più un acconto per l'anno dopo. Mettere da parte qualcosa ogni mese evita la sorpresa: inserisci le CU per la stima.",
    });
  }
  if (s.childIncomeRisk) {
    alerts.push({
      key: "child-income",
      tone: "warn",
      title: "Un figlio vicino al limite per restare a carico",
      text: "Fino a 24 anni il limite è 4.000 € di reddito nell'anno (2.840,51 € dopo), lordi: un euro in più e la detrazione si perde per tutto l'anno, per entrambi i genitori.",
    });
  }
  if (summary.lostToCash > 0) {
    alerts.push({
      key: "cash",
      tone: "warn",
      title: `${eur(summary.lostToCash)} persi per pagamenti in contanti`,
      text: "Visite private, veterinario, scuola e sport valgono solo se pagati con carta, bancomat o bonifico. Farmaci e ticket invece vanno bene anche in contanti.",
    });
  }
  if (summary.toCheck > 0) {
    alerts.push({
      key: "to-check",
      tone: "info",
      title:
        summary.toCheck === 1 ? "1 spesa da confermare" : `${summary.toCheck} spese da confermare`,
      text: "Potrebbero valere per il 730: dimmi tu se contano, così la stima è giusta.",
    });
  }

  for (const t of summary.byType) {
    const rule = RULES[t.type as DeductionType];
    if (t.belowFranchigia && rule.franchigia) {
      alerts.push({
        key: `franchigia-${t.type}`,
        tone: "info",
        title: `${rule.label}: ancora sotto la franchigia`,
        text: `I primi ${eur(rule.franchigia)} non rendono niente: mancano ${eur(cents(rule.franchigia - t.eligible))}. Da lì in poi ogni euro ti rende il 19%.`,
      });
    }
    if (t.cap !== null && t.eligible >= t.cap) {
      alerts.push({
        key: `cap-${t.type}`,
        tone: "good",
        title: `${rule.label}: tetto raggiunto`,
        text: `Hai già ${eur(t.eligible)}, il massimo che conta è ${eur(t.cap)}${rule.perChild ? ` (con ${Math.max(1, input.children)} ${input.children === 1 ? "figlio" : "figli"})` : ""}: le altre ricevute di quest'anno non cambiano il rimborso.`,
      });
    }
  }

  // December: the last weeks of the year decide which 730 an expense goes into.
  if (inYear && today >= `${year}-12-01`) {
    alerts.push({
      key: "year-end",
      tone: "info",
      title: "Ultime settimane dell'anno",
      text: `Conta la data del pagamento: quello che paghi entro il 31 dicembre va nel 730/${year + 1}, dal 1° gennaio in quello dell'anno dopo.`,
    });
  }
  return alerts;
}

/**
 * The note for a deductible expense just saved, when it crosses a line: the franchigia (from
 * here on it pays back) or the limit (the next ones won't). `before`: the year's eligible total
 * of that type, without this expense.
 */
export function crossingNote(type: DeductionType, before: number, amount: number, children = 0) {
  const rule = RULES[type];
  const after = before + amount;
  if (rule.franchigia && before <= rule.franchigia && after > rule.franchigia) {
    return `${rule.label}: superata la franchigia di ${eur(rule.franchigia)}. Da qui ogni euro ti torna al ${Math.round(rule.rate * 100)}% col 730.`;
  }
  if (rule.cap) {
    const cap = rule.cap * (rule.perChild ? Math.max(1, children) : 1);
    if (before < cap && after >= cap) {
      return `${rule.label}: raggiunto il tetto di ${eur(cap)} per quest'anno. Le prossime spese di questo tipo non aumentano il rimborso.`;
    }
  }
  return null;
}
