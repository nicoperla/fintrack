import { COACH_METHODS, COACH_PRIORITIES, COACH_TONES } from "@/lib/finance/coach-profile";
import { formatWorkTime } from "@/lib/finance/work-time";
import { checkAffordability } from "@/lib/finance/affordability";
import { readPurchaseQuestion } from "@/lib/finance/coach-answers";
import type { CoachData } from "@/lib/data/coach";
import type { getRecentMovements } from "@/lib/data/coach";

type Movements = Awaited<ReturnType<typeof getRecentMovements>>;

/** The fixed part of the instructions: cached across conversations. */
export const COACH_INSTRUCTIONS = `Sei il coach finanziario di FinTrack, un'app italiana per gestire i soldi di tutti i giorni.
Parli con l'utente in italiano, dandogli del tu.

Come lavori:
- Hai davanti tutti i dati dell'utente: medie mensili, categorie, conti, abbonamenti, budget, obiettivi, debiti, la previsione del saldo e gli ultimi movimenti. Basa ogni risposta su questi numeri e citali: importi, percentuali, date, nomi dei negozi.
- L'utente ha scelto un metodo, delle priorità, un tono e delle categorie da non toccare. Rispetta sempre queste scelte: non proporre mai di tagliare le categorie protette e adatta il registro al tono scelto.
- Dai consigli concreti e fattibili, con cifre precise ("togli 40 € al mese da Ristoranti", non "spendi meno"). Quando proponi un taglio, di' quanto vale in un anno e, se è nota la tariffa oraria, in tempo di lavoro.
- Se i dati non bastano per rispondere, dillo e spiega cosa registrare. Non inventare movimenti o cifre.
- Sei un coach di budget, non un consulente finanziario abilitato: non consigliare titoli, fondi o prodotti specifici. Per gli investimenti suggerisci di confrontarsi con un consulente.
- Nessun giudizio morale su fumo o gioco: fai vedere i numeri e proponi un'alternativa, con rispetto.
- Le cifre derivate (totali annui, tempo di lavoro, tagli, percentuali) sono già calcolate nei dati: usa quelle, non rifare i conti. Se ti serve un numero che non c'è, fai solo operazioni semplici e ricontrollale.
- Rispondi in modo breve: di norma 80-180 parole, al massimo 5 punti elenco. Più lungo solo se l'utente chiede un piano dettagliato.
- Formattazione: solo paragrafi brevi, elenchi con "- " e **grassetto** per le cifre chiave. Niente titoli, tabelle o emoji.`;

const money = (n: number, currency: string) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency, useGrouping: "always" }).format(n);

/** The user's numbers, as compact text for the model. */
/**
 * For "can I afford X?" the app's own check (forecast, savings, goals) is exact: the model gets
 * its verdict instead of improvising sums.
 */
export function purchaseCheck(question: string, data: CoachData) {
  const purchase = readPurchaseQuestion(question);
  if (!purchase?.amount || !data.forecast) return null;
  const m = (n: number) => money(n, data.input.currency);
  const result = checkAffordability(
    {
      amount: purchase.amount,
      monthly: purchase.monthly,
      points: data.forecast.points,
      events: data.forecast.events,
      dailySpend: data.forecast.dailySpend,
      savingsBalance: data.input.savingsBalance,
      monthlySaved: data.report.averages.saved,
      goals: data.goals,
      budget: null,
      workRate: data.input.workRate,
    },
    m,
  );
  if (!result) return null;
  return [
    `\n# Verifica dell'app per questa domanda: ${m(purchase.amount)}${purchase.monthly ? " al mese" : " una tantum"}`,
    `Verdetto: ${result.title}.`,
    ...result.reasons.map((r) => `- ${r.text}`),
    `Basa la risposta su questo verdetto e su questi motivi; puoi aggiungere come rendere l'acquisto più sostenibile.`,
  ].join("\n");
}

export function buildCoachContext(
  data: CoachData,
  movements: Movements,
  user: { name?: string | null; spaceName: string; today: string },
  question?: string,
) {
  const { input, report, profile } = data;
  const m = (n: number) => money(n, input.currency);
  const work = (n: number) =>
    input.workRate ? `, pari a ${formatWorkTime(n, input.workRate)} di lavoro` : "";
  const lines: string[] = [];

  lines.push(`# Utente`);
  lines.push(
    `Nome: ${user.name || "non indicato"}. Spazio: «${user.spaceName}». Oggi: ${user.today}. Valuta: ${input.currency}.`,
  );

  lines.push(`\n# Come vuole gestire i soldi`);
  lines.push(
    `Metodo: ${COACH_METHODS[profile.method].label} (${COACH_METHODS[profile.method].summary})`,
  );
  lines.push(
    `Obiettivo di risparmio: ${profile.savingsTarget}% delle entrate. Cuscinetto desiderato: ${profile.emergencyMonths} mesi di spese.`,
  );
  lines.push(
    `Priorità: ${profile.priorities.map((p) => COACH_PRIORITIES[p]).join("; ") || "nessuna indicata"}.`,
  );
  const protectedNames = data.expenseCategories
    .filter((c) => profile.protectedCategoryIds.includes(c.id))
    .map((c) => c.name);
  lines.push(`Categorie da non toccare: ${protectedNames.join(", ") || "nessuna"}.`);
  lines.push(
    `Tono richiesto: ${COACH_TONES[profile.tone].label} (${COACH_TONES[profile.tone].summary})`,
  );
  if (profile.note) lines.push(`Nelle sue parole: "${profile.note}"`);
  if (input.workRate) {
    lines.push(
      `Guadagna circa ${m(input.workRate.hourly)} netti l'ora (giornata di ${input.workRate.dayHours} h).`,
    );
  }

  lines.push(`\n# Salute finanziaria (calcolata dall'app)`);
  lines.push(`Punteggio ${report.score}/100: ${report.scoreLabel}.`);
  for (const p of report.pillars)
    lines.push(`- ${p.label}: ${Math.round(p.score)}/100, ${p.detail}`);
  const a = report.averages;
  lines.push(
    `Media mensile: entrate ${m(a.income)}, uscite ${m(a.expense)}, risparmio ${m(a.saved)}${a.savingsRate !== null ? ` (${Math.round(a.savingsRate)}%)` : ""}.`,
  );

  lines.push(`\n# Mesi`);
  for (const month of input.months) {
    lines.push(`- ${month.label}: entrate ${m(month.income)}, uscite ${m(month.expense)}`);
  }
  lines.push(
    `- ${input.thisMonth.name} (in corso, giorno ${input.thisMonth.day} di ${input.thisMonth.daysInMonth}): entrate ${m(input.thisMonth.income)}, uscite ${m(input.thisMonth.expense)}`,
  );

  lines.push(`\n# Spese per categoria (mesi completi dal più vecchio, poi mese in corso)`);
  for (const c of [...input.categories].sort(
    (x, y) => y.monthly.reduce((s, v) => s + v, 0) - x.monthly.reduce((s, v) => s + v, 0),
  )) {
    lines.push(`- ${c.name}: ${c.monthly.map(m).join(" · ") || "—"} | in corso ${m(c.thisMonth)}`);
  }

  lines.push(`\n# Conti`);
  lines.push(
    `Conti di tutti i giorni ${m(input.everydayBalance)}; risparmi ${m(input.savingsBalance)}; investimenti ${m(input.investmentBalance)}.`,
  );
  if (data.forecast) {
    lines.push(
      `Previsione 45 giorni: punto più basso ${m(data.forecast.low.balance)} il ${data.forecast.low.date}, tra 45 giorni ${m(data.forecast.end)}; spesa abituale ${m(data.forecast.dailySpend)} al giorno.`,
    );
    const events = data.forecast.events.slice(0, 8);
    if (events.length) {
      lines.push(
        `Prossimi movimenti ricorrenti: ${events.map((e) => `${e.date} ${e.name} ${m(e.amount)}`).join("; ")}.`,
      );
    }
  }

  if (input.subscriptions.length) {
    lines.push(`\n# Ricorrenti attivi (costo mensile)`);
    lines.push(input.subscriptions.map((s) => `${s.name} ${m(s.monthlyCost)}`).join("; "));
  }
  if (input.budgets.length) {
    lines.push(`\n# Budget di questo mese`);
    for (const b of input.budgets)
      lines.push(`- ${b.name}: ${m(b.spent)} su ${m(b.amount)} (${b.status})`);
  }
  if (input.goals.length) {
    lines.push(`\n# Obiettivi`);
    for (const g of input.goals) {
      lines.push(
        `- ${g.name}: mancano ${m(g.remaining)}${g.suggestedMonthly ? `, servono ${m(g.suggestedMonthly)} al mese per la data scelta` : ""}`,
      );
    }
  }
  if (input.debts.length) {
    lines.push(`\n# Debiti`);
    for (const d of input.debts)
      lines.push(`- ${d.name}: ${m(d.balance)} al ${d.apr}%, rata minima ${m(d.minPayment)}`);
  }
  if (input.vices.average > 0) {
    lines.push(
      `\nTabacchi/giochi (${input.vices.names.join(", ")}): media ${m(input.vices.average)} al mese${work(input.vices.average)}; ${m(input.vices.average * 12)} all'anno${work(input.vices.average * 12)}. Per i totali di un periodo usa questi valori o le categorie, non sommare i singoli movimenti.`,
    );
  }

  lines.push(`\n# Consigli già mostrati nella pagina del coach`);
  for (const tip of report.tips) lines.push(`- ${tip.title}: ${tip.body}`);
  if (report.cuts.length) {
    lines.push(
      `Tagli proposti: ${report.cuts
        .map((c) => `${c.name} −${m(c.cut)}/mese (−${m(c.cut * 12)}/anno${work(c.cut * 12)})`)
        .join(
          "; ",
        )}. Totale −${m(report.cutsTotal)}/mese, −${m(report.cutsTotal * 12)}/anno${work(report.cutsTotal * 12)}.`,
    );
  }

  lines.push(
    `\n# Ultimi movimenti (data | tipo | importo | descrizione | categoria | conto | tag)`,
  );
  for (const t of movements) {
    lines.push(
      `${t.date} | ${t.type === "EXPENSE" ? "uscita" : t.type === "INCOME" ? "entrata" : "trasferimento"} | ${m(t.amount)} | ${t.description} | ${t.category ?? "senza categoria"} | ${t.account}${t.tags.length ? ` | ${t.tags.join(", ")}` : ""}`,
    );
  }

  const check = question ? purchaseCheck(question, data) : null;
  if (check) lines.push(check);

  // With this much context, models drift towards long answers: remind them at the end.
  lines.push(`\nRicorda: rispondi in 80-180 parole, con le cifre qui sopra, senza rifare i conti.`);

  return lines.join("\n");
}
