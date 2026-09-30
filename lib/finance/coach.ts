import { formatWholeCurrency } from "@/lib/format";
import { formatWorkTime, type WorkRate } from "@/lib/finance/work-time";
import { inMonth } from "@/lib/finance/insights";
import { COACH_METHODS, type CoachProfile, type CoachTone } from "@/lib/finance/coach-profile";

/*
 * The money coach: reads the space's numbers and turns them into a health score, a plan that
 * follows the method the user chose and a short list of concrete tips. Pure and deterministic,
 * so it works without any AI and gives the AI coach solid facts to talk about.
 */

export type CoachCategory = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  /** Spending in the last complete months, oldest first. */
  monthly: number[];
  thisMonth: number;
};

export type CoachInput = {
  profile: CoachProfile;
  currency: string;
  /** Last complete months, oldest first (up to three). */
  months: { label: string; income: number; expense: number }[];
  thisMonth: { name: string; income: number; expense: number; day: number; daysInMonth: number };
  /** Top-level expense categories. */
  categories: CoachCategory[];
  savingsBalance: number;
  everydayBalance: number;
  investmentBalance: number;
  subscriptions: { name: string; monthlyCost: number }[];
  budgets: { name: string; categoryId: string; amount: number; spent: number; status: string }[];
  goals: { name: string; remaining: number; suggestedMonthly: number | null }[];
  debts: { name: string; balance: number; apr: number; minPayment: number }[];
  forecast: { lowDate: string; lowBalance: number; dailySpend: number } | null;
  /** Tobacco, betting, lottery: monthly average of the last complete months. */
  vices: { names: string[]; average: number; categoryIds: string[] };
  /** Expenses under 10 in the last 30 days. */
  smallExpenses: { count: number; total: number };
  uncategorized: number;
  /** Day of the month the salary usually arrives. */
  salaryDay: number | null;
  workRate: WorkRate | null;
};

export type CoachTipKind = "alert" | "warn" | "good" | "idea";

export type CoachTip = {
  id: string;
  kind: CoachTipKind;
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
};

export type CoachPillar = {
  id: "savings" | "cushion" | "control" | "debt";
  label: string;
  score: number;
  detail: string;
};

export type CoachPlanRow = {
  label: string;
  actual: number;
  target: number;
  unit: "pct" | "money" | "months" | "count";
  /** Whether "actual" should stay below the target (spending) or reach it (savings). */
  direction: "max" | "min";
};

export type CoachCut = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  average: number;
  cut: number;
};

export type CoachReport = {
  hasData: boolean;
  score: number;
  scoreLabel: string;
  headline: string;
  pillars: CoachPillar[];
  averages: { income: number; expense: number; saved: number; savingsRate: number | null };
  plan: { title: string; summary: string; rows: CoachPlanRow[]; note: string | null };
  tips: CoachTip[];
  cuts: CoachCut[];
  cutsTotal: number;
  challenge: { title: string; body: string };
};

// Top-level categories that are needs in the 50/30/20 sense; everything else is a want.
const NEEDS = new Set([
  "casa",
  "spesa",
  "trasporti",
  "salute",
  "assicurazioni",
  "tasse e commissioni",
  "istruzione",
  "famiglia e figli",
  "animali",
  "bollette",
  "utenze",
  "affitto",
  "mutuo",
]);

export const isNeed = (name: string) => NEEDS.has(name.trim().toLowerCase());

const mean = (values: number[]) =>
  values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const pct = (n: number) => `${Math.round(n)}%`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Future value of a monthly saving, compounded monthly. */
export function futureValue(monthly: number, years: number, annualRate: number) {
  const r = annualRate / 12;
  const n = years * 12;
  return r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r);
}

/**
 * Years until investments reach `target`, starting from `start` and adding `yearly` at the end
 * of each year at `rate`. Null when it never gets there.
 */
export function yearsToTarget(start: number, yearly: number, target: number, rate = 0.05) {
  if (start >= target) return 0;
  if (yearly <= 0) return null;
  let value = start;
  for (let year = 1; year <= 80; year++) {
    value = value * (1 + rate) + yearly;
    if (value >= target) return year;
  }
  return null;
}

const HEADLINES: Record<CoachTone, [string, string, string, string]> = {
  gentile: [
    "Stai gestendo i tuoi soldi davvero bene.",
    "Sei sulla buona strada, con qualche margine per migliorare.",
    "Ci sono alcune cose su cui lavorare insieme, un passo alla volta.",
    "È un periodo impegnativo: ripartiamo da un piano semplice.",
  ],
  diretto: [
    "Conti in ordine: continua così.",
    "Buona base, ma ci sono punti da sistemare.",
    "Così non raggiungi i tuoi obiettivi: servono dei cambiamenti.",
    "Situazione critica: bisogna intervenire subito.",
  ],
  motivante: [
    "Sei in formissima: ora alziamo l'asticella!",
    "Ci sei quasi: un paio di mosse e fai il salto.",
    "È il momento di rimboccarsi le maniche: si può fare!",
    "Ogni campione riparte da una giornata storta. Si comincia oggi!",
  ],
};

function scoreBand(score: number) {
  if (score >= 80) return { index: 0, label: "Ottima forma" };
  if (score >= 60) return { index: 1, label: "In buona salute" };
  if (score >= 40) return { index: 2, label: "Si può migliorare" };
  return { index: 3, label: "Serve un piano" };
}

const longDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function buildCoachReport(input: CoachInput): CoachReport {
  const { profile } = input;
  const money = (n: number) => formatWholeCurrency(n, input.currency);
  const protectedIds = new Set(profile.protectedCategoryIds);

  // Averages over the complete months; a brand-new user gets this month projected to its end.
  const projected = input.thisMonth.day > 0 ? input.thisMonth.daysInMonth / input.thisMonth.day : 1;
  const income = input.months.length
    ? mean(input.months.map((m) => m.income))
    : input.thisMonth.income;
  const expense = input.months.length
    ? mean(input.months.map((m) => m.expense))
    : input.thisMonth.expense * projected;
  const saved = income - expense;
  const savingsRate = income > 0 ? (saved / income) * 100 : null;
  const hasData = input.months.length > 0 || input.thisMonth.expense > 0;
  const target = profile.savingsTarget;

  const categoryAverage = (c: CoachCategory) =>
    c.monthly.length ? mean(c.monthly) : c.thisMonth * projected;
  const needs = input.categories.filter((c) => isNeed(c.name));
  const wants = input.categories.filter((c) => !isNeed(c.name));
  const needsTotal = needs.reduce((s, c) => s + categoryAverage(c), 0);
  const wantsTotal = wants.reduce((s, c) => s + categoryAverage(c), 0);

  // ---------- Pillars ----------

  const cushionMonths = expense > 0 ? input.savingsBalance / expense : 0;
  const pillars: CoachPillar[] = [];

  pillars.push({
    id: "savings",
    label: "Risparmio",
    score:
      savingsRate === null || savingsRate <= 0
        ? 0
        : target === 0
          ? 100
          : clamp((savingsRate / target) * 100),
    detail:
      savingsRate === null
        ? "Registra le entrate per misurarlo"
        : savingsRate < 0
          ? "Spendi più di quanto entra"
          : `Metti da parte il ${pct(savingsRate)} (obiettivo ${target}%)`,
  });

  pillars.push({
    id: "cushion",
    label: "Cuscinetto",
    score: clamp((cushionMonths / profile.emergencyMonths) * 100),
    detail: `${cushionMonths >= 10 ? Math.round(cushionMonths) : cushionMonths.toFixed(1).replace(".", ",")} mesi di spese coperti (obiettivo ${profile.emergencyMonths})`,
  });

  const over = input.budgets.filter((b) => b.status === "over");
  const warning = input.budgets.filter((b) => b.status === "warning");
  const pace =
    input.months.length && expense > 0 ? (input.thisMonth.expense * projected) / expense : 1;
  let control = 100 - over.length * 20 - warning.length * 8 - (pace > 1.15 ? 20 : 0);
  if (input.budgets.length === 0) control = Math.min(control, 70);
  pillars.push({
    id: "control",
    label: "Controllo",
    score: clamp(control),
    detail:
      input.budgets.length === 0
        ? "Nessun budget impostato"
        : over.length
          ? `${over.length === 1 ? "1 budget sforato" : `${over.length} budget sforati`} questo mese`
          : "Budget rispettati questo mese",
  });

  const minPayments = input.debts.reduce((s, d) => s + d.minPayment, 0);
  const debtRatio = income > 0 ? minPayments / income : minPayments > 0 ? 1 : 0;
  const expensiveDebt = input.debts.some((d) => d.apr >= 15);
  pillars.push({
    id: "debt",
    label: "Debiti",
    score:
      input.debts.length === 0
        ? 100
        : clamp(
            (debtRatio <= 0.1 ? 85 : debtRatio <= 0.2 ? 65 : debtRatio <= 0.35 ? 40 : 15) -
              (expensiveDebt ? 10 : 0),
          ),
    detail:
      input.debts.length === 0
        ? "Nessun debito"
        : `Le rate valgono il ${pct(debtRatio * 100)} delle entrate`,
  });

  const weights = { savings: 0.35, cushion: 0.25, control: 0.2, debt: 0.2 };
  const score = Math.round(pillars.reduce((s, p) => s + p.score * weights[p.id], 0));
  const band = scoreBand(score);

  // ---------- Cuts: wants the user didn't protect ----------

  const viceIds = new Set(input.vices.categoryIds);
  const cuts: CoachCut[] = wants
    .filter((c) => !protectedIds.has(c.id))
    .map((c) => {
      const average = categoryAverage(c);
      // Vices get a bolder cut: halving them is realistic and worth a lot.
      const share = viceIds.has(c.id) ? 0.5 : 0.2;
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        average,
        cut: Math.max(5, roundTo(average * share, 5)),
      };
    })
    .filter((c) => c.average >= 25)
    .sort((a, b) => b.cut - a.cut)
    .slice(0, 4);
  const cutsTotal = cuts.reduce((s, c) => s + c.cut, 0);

  // ---------- Tips ----------

  const tips: (CoachTip & { priority: number })[] = [];
  const has = (p: CoachProfile["priorities"][number]) => profile.priorities.includes(p);

  if (input.forecast && input.forecast.lowBalance < 0) {
    const missing = -input.forecast.lowBalance;
    tips.push({
      id: "forecast",
      kind: "alert",
      priority: 1000,
      title: "Rischi di andare in rosso",
      body: `Il ${longDate.format(new Date(`${input.forecast.lowDate}T00:00:00Z`))} i conti di tutti i giorni scenderebbero a ${money(input.forecast.lowBalance)}. ${
        input.savingsBalance >= missing
          ? `Sposta ${money(roundTo(missing + 50, 50))} dai risparmi o rimanda le spese che possono aspettare.`
          : "Rimanda le spese che possono aspettare finché non arriva la prossima entrata."
      }`,
      href: "/dashboard",
      hrefLabel: "Vedi la previsione",
    });
  }

  if (income > 0 && savingsRate !== null) {
    const gap = (target / 100) * income - saved;
    if (gap > 5) {
      tips.push({
        id: "savings-gap",
        kind: savingsRate < 0 ? "alert" : "warn",
        priority: 800,
        title:
          savingsRate < 0
            ? `Spendi ${money(-saved)} al mese più di quanto entra`
            : `Ti mancano ${money(gap)} al mese per il tuo obiettivo`,
        body: `${savingsRate < 0 ? "Negli ultimi mesi le uscite hanno superato le entrate" : `Metti da parte il ${pct(savingsRate)} delle entrate`}, il tuo obiettivo è il ${target}%.${
          cutsTotal > 0
            ? ` I tagli che ti propongo valgono ${money(cutsTotal)} al mese${cutsTotal >= gap ? ": basterebbero a colmare la differenza." : "."}`
            : ""
        }`,
      });
    } else if (hasData) {
      tips.push({
        id: "savings-ok",
        kind: "good",
        priority: 300,
        title: "Obiettivo di risparmio centrato",
        body: `Metti da parte il ${pct(savingsRate)} delle entrate, sopra il tuo ${target}%: ${money(saved)} al mese.`,
      });
    }
  }

  const needsPct = income > 0 ? (needsTotal / income) * 100 : 0;
  const wantsPct = income > 0 ? (wantsTotal / income) * 100 : 0;

  if (profile.method === "50-30-20" && income > 0) {
    if (wantsPct > 35) {
      tips.push({
        id: "wants",
        kind: "warn",
        priority: 600,
        title: `I desideri pesano il ${pct(wantsPct)} delle entrate`,
        body: `Con il 50/30/20 dovrebbero restare entro il 30%: sono ${money(wantsTotal - income * 0.3)} al mese oltre la soglia.`,
      });
    }
    if (needsPct > 55) {
      tips.push({
        id: "needs",
        kind: "idea",
        priority: 450,
        title: "Le spese necessarie sono alte",
        body: `Casa, spesa, trasporti e simili prendono il ${pct(needsPct)} delle entrate (l'ideale è il 50%). Se non puoi ridurle, compensa sui desideri o punta ad aumentare le entrate.`,
      });
    }
  }

  if (profile.method === "paga-te-stesso" && income > 0) {
    const amount = roundTo((target / 100) * income, 10);
    tips.push({
      id: "pay-yourself",
      kind: "idea",
      priority: 650,
      title: `Metti da parte ${money(amount)} appena arriva lo stipendio`,
      body: `${input.salaryDay ? `Il giorno ${input.salaryDay}, quando arriva lo stipendio, ` : "Il giorno in cui arriva lo stipendio "}sposta subito ${money(amount)} sul conto risparmio (il ${target}% delle entrate). Quello che resta è tuo da spendere, senza sensi di colpa.`,
    });
  }

  if (profile.method === "buste") {
    const budgeted = new Set(input.budgets.map((b) => b.categoryId));
    const missing = input.categories
      .filter((c) => !budgeted.has(c.id) && categoryAverage(c) >= 50)
      .sort((a, b) => categoryAverage(b) - categoryAverage(a))
      .slice(0, 3);
    if (missing.length) {
      tips.push({
        id: "envelopes",
        kind: "idea",
        priority: 600,
        title: `Dai un tetto a ${missing.map((c) => c.name).join(", ")}`,
        body: missing
          .map(
            (c) =>
              `${c.name}: in media ${money(categoryAverage(c))} al mese, prova con ${money(roundTo(categoryAverage(c) * (protectedIds.has(c.id) ? 1 : 0.9), 10))}`,
          )
          .join("; ")
          .concat("."),
        href: "/budgets",
        hrefLabel: "Crea i budget",
      });
    }
  }

  if (profile.method === "fire" && expense > 0) {
    const fiNumber = expense * 12 * 25;
    const invested = input.savingsBalance + input.investmentBalance;
    const years = yearsToTarget(invested, Math.max(0, saved) * 12, fiNumber);
    const yearsAt40 = income > 0 ? yearsToTarget(invested, income * 0.4 * 12, fiNumber) : null;
    tips.push({
      id: "fire",
      kind: "idea",
      priority: 550,
      title: `Il tuo numero della libertà: ${money(roundTo(fiNumber, 1000))}`,
      body: `È 25 volte quello che spendi in un anno. ${
        years === null
          ? "Al ritmo attuale non ci arrivi: prima serve risparmiare ogni mese."
          : `Al ritmo attuale ci arrivi in circa ${years} anni`
      }${yearsAt40 !== null && (years === null || yearsAt40 < years) ? `${years === null ? " Risparmiando" : "; risparmiando"} il 40% delle entrate in ${yearsAt40}.` : "."} Stima con un rendimento del 5% annuo al netto dell'inflazione.`,
    });
  }

  const wantsCushion = has("fondo-emergenza") || profile.method === "sereno" || cushionMonths < 1;
  if (wantsCushion && expense > 0) {
    const goal = expense * profile.emergencyMonths;
    const missing = goal - input.savingsBalance;
    if (missing > 0) {
      const months = saved > 0 ? Math.ceil(missing / saved) : null;
      tips.push({
        id: "cushion",
        kind: cushionMonths < 1 ? "warn" : "idea",
        priority: profile.method === "sereno" ? 760 : 700,
        title: `Il cuscinetto copre ${cushionMonths < 1 ? "meno di un mese" : `${Math.floor(cushionMonths)} ${Math.floor(cushionMonths) === 1 ? "mese" : "mesi"}`} di spese`,
        body: `Per arrivare a ${profile.emergencyMonths} mesi ti mancano ${money(missing)}.${
          months
            ? ` Al ritmo di risparmio attuale (${money(saved)} al mese) ci arrivi in circa ${months} ${months === 1 ? "mese" : "mesi"}.`
            : " Parti da una cifra piccola ma fissa ogni mese: conta più la costanza dell'importo."
        }`,
        href: "/goals",
        hrefLabel: "Crea un obiettivo",
      });
    } else if (profile.method === "sereno" || has("fondo-emergenza")) {
      tips.push({
        id: "cushion-ok",
        kind: "good",
        priority: 200,
        title: "Cuscinetto al completo",
        body: `Hai ${money(input.savingsBalance)} da parte: più di ${profile.emergencyMonths} mesi di spese. Gli imprevisti non ti fanno paura.`,
      });
    }
  }

  const priciest = [...input.debts].sort((a, b) => b.apr - a.apr)[0];
  if (priciest && (has("debiti") || priciest.apr >= 10)) {
    tips.push({
      id: "debt",
      kind: priciest.apr >= 15 ? "warn" : "idea",
      priority: has("debiti") ? 690 : 520,
      title: `Attacca per primo «${priciest.name}»`,
      body: `Ha il tasso più alto (${priciest.apr.toString().replace(".", ",")}%): ogni euro in più versato lì ti fa risparmiare più interessi che altrove. Paga il minimo sugli altri e concentra il resto qui.`,
      href: "/debts",
      hrefLabel: "Apri il piano debiti",
    });
  }

  const vicesProtected = input.vices.categoryIds.some((id) => protectedIds.has(id));
  if (input.vices.average >= 10 && !vicesProtected) {
    const yearly = input.vices.average * 12;
    const work = input.workRate ? formatWorkTime(yearly, input.workRate) : null;
    tips.push({
      id: "vices",
      kind: has("vizi") ? "warn" : "idea",
      priority: has("vizi") ? 720 : 420,
      title: `${input.vices.names.join(" e ")}: ${money(yearly)} all'anno`,
      body: `In media ${money(input.vices.average)} al mese${work ? `, cioè ${work} di lavoro all'anno` : ""}. ${
        has("vizi") ? `Dimezzarli vale ${money(yearly / 2)} all'anno;` : "Se li mettessi da parte,"
      } in 10 anni al 3% diventerebbero ${money(futureValue(has("vizi") ? input.vices.average / 2 : input.vices.average, 10, 0.03))}.`,
    });
  }

  const drifting = input.categories
    .filter((c) => !protectedIds.has(c.id) && c.monthly.length >= 2)
    .map((c) => {
      const last = c.monthly[c.monthly.length - 1];
      const before = mean(c.monthly.slice(0, -1));
      return { c, last, before };
    })
    // Below 25 a month there's no habit to compare with: percentages would be meaningless.
    .filter((d) => d.before >= 25 && d.last > d.before * 1.25 && d.last - d.before >= 30)
    .sort((a, b) => b.last - b.before - (a.last - a.before))
    .slice(0, 2);
  const lastMonthLabel = input.months[input.months.length - 1]?.label;
  for (const d of drifting) {
    tips.push({
      id: `drift-${d.c.id}`,
      kind: "warn",
      priority: 500,
      title: `${d.c.name} in crescita`,
      body: `${lastMonthLabel ? capitalize(inMonth(lastMonthLabel)) : "Il mese scorso"} ${money(d.last)}, contro una media di ${money(d.before)} nei mesi prima (+${pct(((d.last - d.before) / d.before) * 100)}). È una scelta o è scappata di mano?`,
    });
  }

  if (input.smallExpenses.count >= 15) {
    tips.push({
      id: "small",
      kind: "idea",
      priority: 380,
      title: "Le piccole spese fanno massa",
      body: `Negli ultimi 30 giorni ${input.smallExpenses.count} spese sotto i 10 € per ${money(input.smallExpenses.total)}: sono circa ${money(input.smallExpenses.total * 12)} all'anno, senza accorgersene.`,
    });
  }

  const subscriptionsTotal = input.subscriptions.reduce((s, x) => s + x.monthlyCost, 0);
  if (subscriptionsTotal >= 20) {
    tips.push({
      id: "subscriptions",
      kind: "idea",
      priority: income > 0 && subscriptionsTotal > income * 0.05 ? 560 : 400,
      title: `Abbonamenti: ${money(subscriptionsTotal)} al mese`,
      body: `${input.subscriptions.length} addebiti ricorrenti, ${money(subscriptionsTotal * 12)} all'anno. Ce n'è qualcuno che non usi più?`,
      href: "/recurring",
      hrefLabel: "Controlla gli abbonamenti",
    });
  }

  if (over.length) {
    tips.push({
      id: "budgets-over",
      kind: "warn",
      priority: 640,
      title: `Budget sforat${over.length === 1 ? "o" : "i"}: ${over.map((b) => b.name).join(", ")}`,
      body: `${over
        .map((b) => `${b.name} ${money(b.spent)} su ${money(b.amount)}`)
        .join("; ")}. Per il resto di ${input.thisMonth.name} rallenta qui o compensa altrove.`,
      href: "/budgets",
      hrefLabel: "Vedi i budget",
    });
  }

  const needed = input.goals.reduce((s, g) => s + (g.suggestedMonthly ?? 0), 0);
  if (needed > 0 && saved < needed) {
    const names = input.goals.filter((g) => g.suggestedMonthly).map((g) => `«${g.name}»`);
    tips.push({
      id: "goals",
      kind: "warn",
      priority: has("viaggi") || has("casa") ? 660 : 560,
      title: "Obiettivi a rischio",
      body: `Per centrare ${names.join(", ")} nei tempi servono ${money(needed)} al mese, ma ne metti da parte ${money(Math.max(0, saved))}. Sposta la data o trova ${money(needed - Math.max(0, saved))} al mese${cutsTotal > 0 ? " (i tagli qui sotto aiutano)" : ""}.`,
      href: "/goals",
      hrefLabel: "Vedi gli obiettivi",
    });
  }

  if (has("investire") && expense > 0 && input.everydayBalance > expense * 2) {
    tips.push({
      id: "idle",
      kind: "idea",
      priority: 520,
      title: "Soldi fermi sul conto",
      body: `Sui conti di tutti i giorni hai ${money(input.everydayBalance)}, più di due mesi di spese. Tieni ${money(expense * 1.5)} per la liquidità: il resto potrebbe lavorare per te. Per scegliere come, confrontati con un consulente abilitato.`,
    });
  }

  if (has("pensione") || has("figli")) {
    const years = has("pensione") ? 30 : 18;
    tips.push({
      id: "long-term",
      kind: "idea",
      priority: 330,
      title: has("pensione") ? "Il tempo lavora per la pensione" : "Un salvadanaio per i figli",
      body: `Ogni 100 € al mese messi da parte per ${years} anni al 3% diventano circa ${money(futureValue(100, years, 0.03))}: il ${pct((1 - (100 * 12 * years) / futureValue(100, years, 0.03)) * 100)} lo fanno gli interessi. Prima inizi, meno devi versare.`,
    });
  }

  if (input.uncategorized >= 5) {
    tips.push({
      id: "uncategorized",
      kind: "idea",
      priority: 250,
      title: "Aiutami a capirti meglio",
      body: `${input.uncategorized} movimenti degli ultimi 3 mesi non hanno una categoria: assegnala e i miei consigli saranno più precisi.`,
      href: "/transactions",
      hrefLabel: "Vai ai movimenti",
    });
  }

  // ---------- Plan for the chosen method ----------

  const method = COACH_METHODS[profile.method];
  const rows: CoachPlanRow[] = [];
  if (profile.method === "50-30-20") {
    rows.push(
      { label: "Bisogni", actual: needsPct, target: 50, unit: "pct", direction: "max" },
      { label: "Desideri", actual: wantsPct, target: 30, unit: "pct", direction: "max" },
      {
        label: "Risparmio",
        actual: savingsRate ?? 0,
        target,
        unit: "pct",
        direction: "min",
      },
    );
  } else if (profile.method === "paga-te-stesso") {
    rows.push(
      {
        label: "Da mettere da parte ogni mese",
        actual: Math.max(0, saved),
        // Same round figure as the tip: a transfer you'd actually set up.
        target: roundTo((target / 100) * income, 10),
        unit: "money",
        direction: "min",
      },
      { label: "Risparmio", actual: savingsRate ?? 0, target, unit: "pct", direction: "min" },
    );
  } else if (profile.method === "buste") {
    const budgeted = new Set(input.budgets.map((b) => b.categoryId));
    rows.push(
      {
        label: "Categorie di spesa con un budget",
        actual: input.categories.filter((c) => budgeted.has(c.id)).length,
        target: input.categories.filter((c) => categoryAverage(c) >= 50).length,
        unit: "count",
        direction: "min",
      },
      {
        label: "Budget sforati questo mese",
        actual: over.length,
        target: 0,
        unit: "count",
        direction: "max",
      },
      { label: "Risparmio", actual: savingsRate ?? 0, target, unit: "pct", direction: "min" },
    );
  } else if (profile.method === "fire") {
    rows.push(
      { label: "Risparmio", actual: savingsRate ?? 0, target, unit: "pct", direction: "min" },
      {
        label: "Verso il numero della libertà",
        actual: input.savingsBalance + input.investmentBalance,
        target: expense * 12 * 25,
        unit: "money",
        direction: "min",
      },
    );
  } else {
    rows.push(
      {
        label: "Mesi di spese coperti",
        actual: cushionMonths,
        target: profile.emergencyMonths,
        unit: "months",
        direction: "min",
      },
      { label: "Risparmio", actual: savingsRate ?? 0, target, unit: "pct", direction: "min" },
    );
  }

  const protectedNames = input.categories.filter((c) => protectedIds.has(c.id)).map((c) => c.name);

  // ---------- Challenge of the week ----------

  const weekly = (monthly: number) => money((monthly * 12) / 52);
  const topCut = cuts[0];
  const challenge =
    input.vices.average >= 10 && !vicesProtected
      ? {
          title: `Una settimana con meno ${input.vices.names[0].toLowerCase()}`,
          body: `Di solito ci spendi ${weekly(input.vices.average)} a settimana. Prova a dimezzare: sono ${money(input.vices.average * 6)} all'anno in tasca.`,
        }
      : topCut
        ? {
            title: `7 giorni con metà ${topCut.name.toLowerCase()}`,
            body: `Di solito ci spendi ${weekly(topCut.average)} a settimana. Questa settimana prova a spenderne la metà e guarda come cambia il saldo.`,
          }
        : {
            title: "Tre giorni senza spese",
            body: "Questa settimana scegli tre giorni in cui non spendi niente: nemmeno un caffè. Te li conto io nei traguardi.",
          };

  return {
    hasData,
    score,
    scoreLabel: band.label,
    headline: HEADLINES[profile.tone][band.index],
    pillars,
    averages: { income, expense, saved, savingsRate },
    plan: {
      title: method.label,
      summary: method.summary,
      rows,
      note: protectedNames.length
        ? `Non ti chiederò di tagliare ${protectedNames.join(", ")}: l'hai scelto tu.`
        : null,
    },
    tips: tips
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 8)
      .map((tip) => {
        const result: CoachTip & { priority?: number } = { ...tip };
        delete result.priority;
        return result;
      }),
    cuts,
    cutsTotal,
    challenge,
  };
}
