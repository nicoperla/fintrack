import { formatCurrency } from "@/lib/format";
import { ilPct } from "@/lib/finance/insights";
import {
  bars,
  button,
  EMAIL_COLORS,
  escapeHtml,
  kpis,
  panel,
  paragraph,
  renderEmail,
  rows,
  sectionTitle,
} from "@/lib/emails/layout";

export type DigestInput = {
  name: string | null;
  /** Base currency of the space: every amount below is in it. */
  currency?: string;
  /** Shown when the space is shared, so members know whose finances these are. */
  spaceName?: string | null;
  /** e.g. "dal 15 al 21 settembre", see weekRangeLabel() */
  weekLabel: string;
  income: number;
  expense: number;
  previousExpense: number;
  count: number;
  topCategories: { name: string; value: number }[];
  /** Only budgets that need attention (warning or over). */
  budgets: { name: string; ratio: number; status: "warning" | "over"; remaining: number }[];
  upcoming: { name: string; amount: number; date: string }[];
  /** "Riprenditeli": open claims with something to do now or a deadline coming up. */
  claims: { id: string; counterparty: string; kind: string; step: string; urgent: boolean }[];
  /** "Radar dei diritti": company welfare credit that expires within a month. */
  welfare: { balance: number; expiresOn: string; days: number } | null;
  /** "Il mio 730": the next step, when its date is close (lib/tax/next-step.ts, digestNote). */
  tax730?: { title: string; text: string } | null;
  /** "Il Tariffometro": RC auto policies and fixed light prices ending within a month. */
  renewals: { kind: "CAR_INSURANCE" | "ELECTRICITY"; label: string; date: string; days: number }[];
  /** "Il caffè dei conti": last month's talk is ready and not done yet (shared spaces). */
  talk: { monthName: string } | null;
  /** "Il patto": the user's pacts running, or over in the last week. */
  pacts: {
    category: string;
    state: "active" | "won" | "lost";
    used: number;
    daysLeft: number;
    finePending: boolean;
  }[];
  streak: { current: number; longest: number };
  level: { level: number; name: string };
  appUrl: string;
  unsubscribeUrl: string;
};

export type DigestEmail = { subject: string; text: string; html: string };

const moneyIn =
  (currency = "EUR") =>
  (n: number) =>
    formatCurrency(n, currency).replace(/[\u00a0\u202f]/g, " ");

const dayFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const day = (iso: string) => dayFormatter.format(new Date(`${iso}T00:00:00Z`));
const longDayFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const longDay = (iso: string) => longDayFormatter.format(new Date(`${iso}T00:00:00Z`));
// "il 31 ottobre", "l'1 novembre": the numbers read with a leading vowel sound.
const onLongDay = (iso: string) =>
  `${[1, 8, 11].includes(Number(iso.slice(8, 10))) ? "l'" : "il "}${longDay(iso)}`;
const when = (days: number, iso: string) =>
  days === 0 ? "oggi" : days === 1 ? "domani" : onLongDay(iso);

function welfareLine(eur: (n: number) => string, w: NonNullable<DigestInput["welfare"]>) {
  return `Il credito welfare di ${eur(w.balance)} scade ${when(w.days, w.expiresOn)}: usalo prima che vada perso.`;
}

function talkLine(talk: NonNullable<DigestInput["talk"]>) {
  return `Il caffè dei conti di ${talk.monthName} è pronto: un quarto d'ora insieme per chiudere il mese.`;
}

function pactLine(p: DigestInput["pacts"][number]) {
  if (p.state === "won") return `Patto «${p.category}» rispettato: complimenti.`;
  if (p.state === "lost") {
    return `Patto «${p.category}» perso.${p.finePending ? " Ricordati la multa: mettila da parte nel tuo obiettivo." : ""}`;
  }
  const left = p.daysLeft === 1 ? "oggi è l'ultimo giorno" : `mancano ${p.daysLeft} giorni`;
  return `Patto «${p.category}»: hai usato ${ilPct(p.used * 100)} del limite, ${left}.`;
}

function renewalLine(r: DigestInput["renewals"][number]) {
  return r.kind === "CAR_INSURANCE"
    ? `La RC auto di «${r.label}» scade ${when(r.days, r.date)}: chiedi i preventivi prima di rinnovare.`
    : `Il prezzo bloccato di «${r.label}» scade ${when(r.days, r.date)}: confronta le offerte prima che cambi.`;
}

export { escapeHtml };

const monthName = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" });
// "dall'1", "dall'8", "dall'11": the numbers read with a leading vowel sound.
const from = (d: number) => ([1, 8, 11].includes(d) ? `dall'${d}` : `dal ${d}`);

/** "dal 15 al 21 settembre", or "dal 29 settembre al 5 ottobre" across months. */
export function weekRangeLabel(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const endPart = `${end.getUTCDate()} ${monthName.format(end)}`;
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${from(start.getUTCDate())} al ${endPart}`
    : `${from(start.getUTCDate())} ${monthName.format(start)} al ${endPart}`;
}

/** Week-over-week change of spending (null without a baseline). */
export function spendingTrend(expense: number, previousExpense: number) {
  if (previousExpense <= 0) return null;
  const pct = Math.round(((expense - previousExpense) / previousExpense) * 100);
  if (pct === 0) return { pct, text: "come la settimana prima", good: true };
  return pct < 0
    ? { pct, text: `${-pct}% in meno della settimana prima`, good: true }
    : { pct, text: `${pct}% in più della settimana prima`, good: false };
}

function subjectFor(input: DigestInput) {
  if (input.count === 0) return "La tua settimana su Orbitly: tutto tranquillo?";
  const eur = moneyIn(input.currency);
  const trend = spendingTrend(input.expense, input.previousExpense);
  const base = `La tua settimana: ${eur(input.expense)} spesi`;
  return trend && trend.pct !== 0 ? `${base} (${trend.pct > 0 ? "+" : ""}${trend.pct}%)` : base;
}

function streakLine({ current, longest }: DigestInput["streak"]) {
  if (current === 0) return "Registra un movimento oggi per iniziare una nuova streak.";
  const days = `${current} ${current === 1 ? "giorno" : "giorni"}`;
  return current >= longest
    ? `Streak di ${days}: è il tuo record, continua così!`
    : `Streak di ${days} (record: ${longest}). Oggi è un buon giorno per allungarla.`;
}

export function buildWeeklyDigest(input: DigestInput): DigestEmail {
  const eur = moneyIn(input.currency);
  const where = input.spaceName ? ` in «${input.spaceName}»` : "";
  const greeting = `Ciao${input.name ? ` ${input.name.split(" ")[0]}` : ""},`;
  const trend = spendingTrend(input.expense, input.previousExpense);
  const net = input.income - input.expense;

  // ---------- Plain text ----------
  const lines: string[] = [
    greeting,
    "",
    `ecco com'è andata la settimana ${input.weekLabel}${where}.`,
    "",
  ];
  if (input.count === 0) {
    lines.push(
      "Non hai registrato movimenti: se hai speso qualcosa, bastano pochi secondi per aggiungerlo.",
    );
  } else {
    lines.push(`Uscite: ${eur(input.expense)}${trend ? ` (${trend.text})` : ""}`);
    lines.push(`Entrate: ${eur(input.income)}`);
    lines.push(`Saldo della settimana: ${eur(net)}`);
    if (input.topCategories.length) {
      lines.push("", "Dove hai speso di più:");
      input.topCategories.forEach((c) => lines.push(`- ${c.name}: ${eur(c.value)}`));
    }
  }
  if (input.talk || input.welfare || input.renewals.length || input.tax730) {
    lines.push("", "Da non perdere:");
    if (input.tax730) {
      lines.push(`- ${input.tax730.title}: ${input.tax730.text}`, `  ${input.appUrl}/730`);
    }
    if (input.talk) lines.push(`- ${talkLine(input.talk)}`, `  ${input.appUrl}/caffe`);
    if (input.welfare) lines.push(`- ${welfareLine(eur, input.welfare)}`);
    input.renewals.forEach((r) =>
      lines.push(`- ${renewalLine(r)}`, `  ${input.appUrl}/ritrovati/tariffometro`),
    );
  }
  if (input.pacts.length) {
    lines.push("", input.pacts.length === 1 ? "Il tuo patto:" : "I tuoi patti:");
    input.pacts.forEach((x) => lines.push(`- ${pactLine(x)}`));
    lines.push(`  ${input.appUrl}/patto`);
  }
  if (input.claims.length) {
    lines.push("", "Pratiche da seguire:");
    input.claims.forEach((c) =>
      lines.push(
        `- ${c.counterparty} (${c.kind.toLowerCase()}): ${c.step}`,
        `  ${input.appUrl}/ritrovati/pratiche/${c.id}`,
      ),
    );
  }
  if (input.budgets.length) {
    lines.push("", "Budget da tenere d'occhio:");
    input.budgets.forEach((b) =>
      lines.push(
        b.status === "over"
          ? `- ${b.name}: sforato di ${eur(-b.remaining)}`
          : `- ${b.name}: ${Math.round(b.ratio * 100)}% usato, restano ${eur(b.remaining)}`,
      ),
    );
  }
  if (input.upcoming.length) {
    lines.push("", "In arrivo nei prossimi 7 giorni:");
    input.upcoming.forEach((u) =>
      lines.push(`- ${day(u.date)}: ${u.name}, circa ${eur(u.amount)}`),
    );
  }
  lines.push(
    "",
    streakLine(input.streak),
    `Livello ${input.level.level}: ${input.level.name}.`,
    "",
    `Apri Orbitly: ${input.appUrl}/dashboard`,
    "",
    `Non vuoi più ricevere il riepilogo? ${input.unsubscribeUrl}`,
  );

  // ---------- HTML ----------
  const e = escapeHtml;
  const subject = subjectFor(input);
  const open = (path: string, label = "Apri") =>
    `<a href="${e(input.appUrl)}${path}" target="_blank" style="color:${EMAIL_COLORS.link};font-weight:700;text-decoration:none;">${label}&nbsp;&rarr;</a>`;
  const section = (title: string, body: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:30px 0 0;"><tr><td>${sectionTitle(title)}${body}</td></tr></table>`;

  const parts: string[] = [
    paragraph(`${e(greeting)} ecco com'è andata la settimana ${e(input.weekLabel)}${e(where)}.`),
  ];
  if (input.count === 0) {
    parts.push(
      panel(
        "Non hai registrato movimenti questa settimana. Se hai speso qualcosa, bastano pochi secondi per aggiungerlo.",
      ),
    );
  } else {
    parts.push(
      kpis([
        {
          label: "Uscite",
          value: eur(input.expense),
          color: "#fb923c",
          note: trend?.text,
          noteColor: trend ? (trend.good ? EMAIL_COLORS.good : EMAIL_COLORS.bad) : undefined,
        },
        { label: "Entrate", value: eur(input.income), color: "#60a5fa" },
        {
          label: "Saldo",
          value: eur(net),
          color: net >= 0 ? EMAIL_COLORS.good : EMAIL_COLORS.bad,
        },
      ]),
    );
    if (input.topCategories.length) {
      const top = Math.max(...input.topCategories.map((c) => c.value));
      parts.push(
        section(
          "Dove hai speso di più",
          bars(
            input.topCategories.map((c) => ({
              label: c.name,
              value: eur(c.value),
              ratio: top > 0 ? c.value / top : 0,
            })),
          ),
        ),
      );
    }
  }
  if (input.talk || input.welfare || input.renewals.length || input.tax730) {
    const notice = (text: string, path: string) =>
      panel(`${e(text)} ${open(path)}`, { tone: "amber", margin: "0 0 10px" });
    parts.push(
      section(
        "Da non perdere",
        [
          input.tax730 ? notice(`${input.tax730.title}. ${input.tax730.text}`, "/730") : "",
          input.talk ? notice(talkLine(input.talk), "/caffe") : "",
          input.welfare ? notice(welfareLine(eur, input.welfare), "/ritrovati/radar") : "",
          ...input.renewals.map((r) => notice(renewalLine(r), "/ritrovati/tariffometro")),
        ].join(""),
      ),
    );
  }
  if (input.pacts.length) {
    const color = { active: EMAIL_COLORS.text, won: EMAIL_COLORS.good, lost: EMAIL_COLORS.bad };
    parts.push(
      section(
        input.pacts.length === 1 ? "Il tuo patto" : "I tuoi patti",
        input.pacts
          .map((x) =>
            paragraph(e(pactLine(x)), { size: 14, color: color[x.state], margin: "0 0 8px" }),
          )
          .join("") + paragraph(open("/patto", "Apri i patti"), { size: 14, margin: "4px 0 0" }),
      ),
    );
  }
  if (input.claims.length) {
    parts.push(
      section(
        "Pratiche da seguire",
        rows(
          input.claims.map((c) => ({
            left: `<strong style="color:${EMAIL_COLORS.heading};">${e(c.counterparty)}</strong> <span style="font-size:12px;color:${EMAIL_COLORS.muted};">${e(c.kind)}</span><br><span style="font-size:13px;color:${c.urgent ? EMAIL_COLORS.warn : EMAIL_COLORS.muted};">${e(c.step)}</span>`,
            right: open(`/ritrovati/pratiche/${e(c.id)}`),
          })),
        ),
      ),
    );
  }
  if (input.budgets.length) {
    parts.push(
      section(
        "Budget da tenere d'occhio",
        rows(
          input.budgets.map((b) =>
            b.status === "over"
              ? {
                  left: e(b.name),
                  right: `sforato di ${e(eur(-b.remaining))}`,
                  rightColor: EMAIL_COLORS.bad,
                }
              : {
                  left: e(b.name),
                  right: `${Math.round(b.ratio * 100)}% · restano ${e(eur(b.remaining))}`,
                  rightColor: EMAIL_COLORS.warn,
                },
          ),
        ),
      ),
    );
  }
  if (input.upcoming.length) {
    parts.push(
      section(
        "In arrivo nei prossimi 7 giorni",
        rows(
          input.upcoming.map((u) => ({
            left: `${e(u.name)} <span style="font-size:12px;color:${EMAIL_COLORS.muted};">${e(day(u.date))}</span>`,
            right: `~ ${e(eur(u.amount))}`,
          })),
        ),
      ),
    );
  }
  parts.push(
    panel(
      `<span style="font-size:20px;">🔥</span>&nbsp; <strong style="color:${EMAIL_COLORS.heading};">${e(streakLine(input.streak))}</strong><br><span style="font-size:12px;color:${EMAIL_COLORS.muted};">Livello ${input.level.level} · ${e(input.level.name)}</span>`,
      { margin: "30px 0 0" },
    ),
    button(`${input.appUrl}/dashboard`, "Apri Orbitly"),
  );

  const html = renderEmail({
    appUrl: input.appUrl,
    title: subject,
    preheader:
      input.count === 0
        ? "Nessun movimento questa settimana: bastano pochi secondi per aggiungerli."
        : `Uscite ${eur(input.expense)} · entrate ${eur(input.income)}${trend ? ` · ${trend.text}` : ""}`,
    tone: "violet",
    label: "Riepilogo settimanale",
    eyebrow: input.weekLabel.charAt(0).toUpperCase() + input.weekLabel.slice(1),
    heading: "La tua settimana",
    html: parts.join("\n"),
    reason: "Ricevi questa email perché hai attivato il riepilogo settimanale.",
    footerHtml: `<a href="${e(input.unsubscribeUrl)}" target="_blank" style="color:${EMAIL_COLORS.muted};text-decoration:underline;">Disattivalo</a> quando vuoi, anche dalle impostazioni.`,
    owner: process.env.LEGAL_OWNER || null,
  });

  return { subject, text: lines.join("\n"), html };
}
