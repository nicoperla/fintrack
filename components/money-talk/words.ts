import type { Suggestion, Win } from "@/lib/finance/money-talk";
import { alPct, ilPct } from "@/lib/finance/insights";
import { onDate } from "@/components/true-salary/format";

/* The sentences of "Il caffè dei conti". Amounts go through the formatters the page passes in,
 * so they hide with the rest of the app in discreet mode. */

export type Formatters = {
  /** "1.234,50 €" */
  money: (n: number) => string;
  /** "1.235 €" */
  whole: (n: number) => string;
};

const monthYear = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "ad agosto", "a settembre"; "ad Anna", "a Luca". */
export const toWord = (word: string) => (/^[aA]/.test(word) ? `ad ${word}` : `a ${word}`);

/** "giugno 2027". */
export const formatMonthYear = (iso: string) => monthYear.format(new Date(`${iso}T00:00:00Z`));

/** The question a suggestion asks, to talk it over before writing the decision. */
export function suggestionText(s: Suggestion, f: Formatters, months: { previous: string }): string {
  switch (s.kind) {
    case "budget":
      return `Il budget «${s.name}» è andato oltre di ${f.money(s.over)}: lo alzate o ci state più attenti?`;
    case "goal-overdue":
      return `La data di «${s.name}» è passata e mancano ${f.whole(s.missing)}: la spostate o aumentate i versamenti?`;
    case "goal-date":
      return `Per «${s.name}» servono ${f.whole(s.monthly)} al mese fino a ${formatMonthYear(s.until)}: chi mette quanto?`;
    case "no-goal":
      return "Non avete ancora un obiettivo comune: ne scegliete uno? Le vacanze, un fondo per gli imprevisti…";
    case "big-expense":
      return `${capitalize(onDate(s.date))} arriva «${s.name}» (${f.money(s.amount)}): i soldi sono già da parte?`;
    case "settle":
      return `${s.from} deve ${f.money(s.amount)} ${toWord(s.to)} per le spese comuni: quando pareggiate?`;
    case "tariff":
      return `${s.label} costa ${f.whole(s.over)} l'anno più del riferimento: chi cerca un'offerta migliore?`;
    case "category-up":
      return `Per «${s.name}» avete speso ${f.money(s.delta)} in più che ${toWord(months.previous)}: un caso o qualcosa da cambiare?`;
    case "subscriptions":
      return `Avete ${s.count} abbonamenti per ${f.money(s.monthly)} al mese: ce n'è uno da disdire?`;
    case "next-month":
      return "Quanto mettete da parte questo mese, e per cosa?";
  }
}

/** Where to go to act on a suggestion, when there is a page for it. */
export function suggestionLink(s: Suggestion): { href: string; label: string } | null {
  switch (s.kind) {
    case "budget":
      return { href: "/budgets", label: "Budget" };
    case "goal-overdue":
    case "goal-date":
    case "no-goal":
      return { href: "/goals", label: "Obiettivi" };
    case "big-expense":
      return { href: "/stipendio-vero", label: "Stipendio vero" };
    case "settle":
      return { href: "/split", label: "Conti chiari" };
    case "tariff":
      return { href: "/ritrovati/tariffometro", label: "Tariffometro" };
    case "subscriptions":
      return { href: "/recurring", label: "Abbonamenti" };
    default:
      return null;
  }
}

/** A headline and, sometimes, a line under it. */
export function winText(
  w: Win,
  f: Formatters,
  months: { previous: string },
): { title: string; detail: string | null } {
  switch (w.kind) {
    case "goal-reached":
      return { title: `«${w.name}»: obiettivo raggiunto!`, detail: "Ce l'avete fatta, insieme." };
    case "decisions-done":
      return w.done === w.total
        ? {
            title:
              w.total === 1
                ? "La decisione dell'ultima volta: fatta."
                : `Le ${w.total} decisioni dell'ultima volta: tutte fatte.`,
            detail: "Avete fatto quello che avevate detto.",
          }
        : {
            title: `${w.done} ${w.done === 1 ? "decisione" : "decisioni"} su ${w.total} dell'ultima volta: ${w.done === 1 ? "fatta" : "fatte"}.`,
            detail: null,
          };
    case "spent-less":
      return {
        title: `${w.pct}% di spese comuni in meno che ${toWord(months.previous)}.`,
        detail: null,
      };
    case "budgets-kept":
      return {
        title:
          w.kept === w.total
            ? w.total === 1
              ? "Budget rispettato."
              : `Tutti e ${w.total} i budget rispettati.`
            : `${w.kept} budget su ${w.total} rispettati.`,
        detail: null,
      };
    case "saved":
      return {
        title: `Avete messo da parte ${ilPct(w.rate)} delle entrate.`,
        detail: `${f.money(w.amount)} che restano a voi.`,
      };
    case "even":
      return { title: "Conti pari: nessuno deve niente a nessuno.", detail: null };
    case "goal-halfway":
      return {
        title: `«${w.name}» è ${alPct(w.progress * 100)}: oltre metà strada.`,
        detail: null,
      };
    case "showed-up":
      return {
        title: "Vi siete presi un quarto d'ora per parlarne.",
        detail: "È la parte più difficile, e l'avete fatta.",
      };
  }
}
