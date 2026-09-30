import type { CoachInput, CoachReport } from "@/lib/finance/coach";
import type { AffordResult } from "@/lib/finance/affordability";
import { formatWorkTime } from "@/lib/finance/work-time";

/*
 * The coach's built-in answers: the common questions, answered from the report without any AI.
 * Used when the AI coach isn't configured or can't be reached.
 */

type Context = {
  input: CoachInput;
  report: CoachReport;
  money: (value: number) => string;
  /** "Can I afford X?" is delegated to the affordability check. */
  afford: (amount: number, monthly: boolean) => AffordResult | null;
};

const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const AMOUNT = /(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[,.](\d{1,2}))?\s*(?:€|euro|eur)?/;

function parseAmount(text: string) {
  const match = text.match(AMOUNT);
  if (!match) return null;
  const whole = Number(match[1].replace(/[.\s]/g, ""));
  const cents = match[2] ? Number(match[2].padEnd(2, "0")) / 100 : 0;
  return whole + cents;
}

const bullet = (lines: string[]) => lines.map((l) => `- ${l}`).join("\n");

export function answerLocally(question: string, ctx: Context): string {
  const q = strip(question);
  const { report, input, money } = ctx;

  if (/permett|posso (comprare|prendere|spendere)|conviene comprare|me lo posso/.test(q)) {
    const amount = parseAmount(question);
    if (!amount) {
      return "Dimmi anche la cifra, per esempio: «Posso permettermi un weekend da 300 €?». Oppure usa il riquadro **Posso permettermelo?** qui sopra.";
    }
    const monthly = /al mese|mensil|abbonament|rata/.test(q);
    const result = ctx.afford(amount, monthly);
    if (!result)
      return "Per rispondere mi serve almeno un conto di tutti i giorni (corrente, carta o contanti).";
    return `**${result.title}.**\n\n${bullet(result.reasons.map((r) => r.text))}`;
  }

  const category = input.categories.find((c) => {
    const name = strip(c.name);
    return q.includes(name) || name.split(/\s+/).some((w) => w.length > 4 && q.includes(w));
  });
  const vices = /fum|sigarett|tabacc|svapo|iqos|gratta|lotto|scommess/.test(q);

  if (vices && input.vices.average > 0) {
    const yearly = input.vices.average * 12;
    return `In ${input.vices.names.join(" e ")} spendi in media **${money(input.vices.average)} al mese**, cioè **${money(yearly)} all'anno**${
      input.workRate ? ` (${formatWorkTime(yearly, input.workRate)} di lavoro)` : ""
    }. Dimezzare vorrebbe dire ${money(yearly / 2)} in più ogni anno.`;
  }

  if (category && /quanto|spes|spend|costa|media/.test(q)) {
    const months = category.monthly;
    const avg = months.length ? months.reduce((s, v) => s + v, 0) / months.length : 0;
    return `In **${category.name}** spendi in media **${money(avg)} al mese**${
      months.length > 1 ? ` (ultimi mesi: ${months.map(money).join(", ")})` : ""
    }; questo mese finora ${money(category.thisMonth)}.`;
  }

  if (/rispar|tagli|taglio|ridurre|dove posso|risparmiare|spreco|sprechi/.test(q)) {
    if (!report.cuts.length) {
      return "Non vedo desideri su cui tagliare senza toccare quello che hai protetto. Guarda gli abbonamenti o prova ad aumentare le entrate.";
    }
    return `Ecco dove taglierei, senza toccare quello che hai protetto:\n\n${bullet(
      report.cuts.map(
        (c) =>
          `**${c.name}**: da ${money(c.average)} a ${money(c.average - c.cut)} al mese (−${money(c.cut)})`,
      ),
    )}\n\nIn tutto **${money(report.cutsTotal)} al mese**, ${money(report.cutsTotal * 12)} all'anno.`;
  }

  if (/abbonament|ricorrent|netflix|spotify|palestra/.test(q)) {
    const total = input.subscriptions.reduce((s, x) => s + x.monthlyCost, 0);
    if (!input.subscriptions.length)
      return "Non ho trovato addebiti ricorrenti nei tuoi movimenti.";
    return `Hai ${input.subscriptions.length} addebiti ricorrenti per **${money(total)} al mese** (${money(total * 12)} all'anno):\n\n${bullet(
      [...input.subscriptions]
        .sort((a, b) => b.monthlyCost - a.monthlyCost)
        .slice(0, 6)
        .map((s) => `${s.name}: ${money(s.monthlyCost)} al mese`),
    )}`;
  }

  if (/debit|prestit|finanziament|rata|rate/.test(q)) {
    const tip = report.tips.find((t) => t.id === "debt");
    if (!input.debts.length) return "Non hai debiti registrati: ottimo.";
    return `${tip ? `**${tip.title}.** ${tip.body}` : ""}\n\nNel **Piano debiti** vedi quando ne esci con il metodo valanga o palla di neve.`;
  }

  if (/obiettiv|traguard|vacanz|giappone|casa nuova/.test(q)) {
    const tip = report.tips.find((t) => t.id === "goals");
    if (tip) return `**${tip.title}.** ${tip.body}`;
    if (!input.goals.length)
      return "Non hai obiettivi aperti. Creane uno e ti dico quanto mettere da parte ogni mese.";
    return `Sei in linea con i tuoi obiettivi: metti da parte ${money(Math.max(0, report.averages.saved))} al mese.`;
  }

  if (/piano|prossimo mese|consigli|cosa (devo|dovrei|posso) fare|aiut/.test(q)) {
    return `Il mio piano per te, in ordine di importanza:\n\n${bullet(
      report.tips.slice(0, 4).map((t) => `**${t.title}.** ${t.body}`),
    )}\n\nSfida della settimana: **${report.challenge.title}**. ${report.challenge.body}`;
  }

  if (/come sto|come va|andando|salute|punteggio|voto|situazione|bilancio/.test(q)) {
    const top = report.tips.slice(0, 2);
    return `Punteggio **${report.score}/100: ${report.scoreLabel}**. ${report.headline}\n\n${bullet(
      report.pillars.map((p) => `${p.label}: ${p.detail}`),
    )}${top.length ? `\n\nDa dove partirei: **${top[0].title}**.` : ""}`;
  }

  return `Posso risponderti su:\n\n${bullet([
    "«Come sto andando?»",
    "«Dove posso risparmiare?»",
    "«Posso permettermi un weekend da 300 €?»",
    "«Quanto spendo in ristoranti?»",
    "«Fammi un piano per il prossimo mese»",
  ])}`;
}
