import { formatCurrency } from "@/lib/format";

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
  /** "Il Tariffometro": RC auto policies and fixed light prices ending within a month. */
  renewals: { kind: "CAR_INSURANCE" | "ELECTRICITY"; label: string; date: string; days: number }[];
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

function renewalLine(r: DigestInput["renewals"][number]) {
  return r.kind === "CAR_INSURANCE"
    ? `La RC auto di «${r.label}» scade ${when(r.days, r.date)}: chiedi i preventivi prima di rinnovare.`
    : `Il prezzo bloccato di «${r.label}» scade ${when(r.days, r.date)}: confronta le offerte prima che cambi.`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  if (input.count === 0) return "La tua settimana su FinTrack: tutto tranquillo?";
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
  if (input.welfare || input.renewals.length) {
    lines.push("", "Da non perdere:");
    if (input.welfare) lines.push(`- ${welfareLine(eur, input.welfare)}`);
    input.renewals.forEach((r) =>
      lines.push(`- ${renewalLine(r)}`, `  ${input.appUrl}/ritrovati/tariffometro`),
    );
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
    `Apri FinTrack: ${input.appUrl}/dashboard`,
    "",
    `Non vuoi più ricevere il riepilogo? ${input.unsubscribeUrl}`,
  );

  // ---------- HTML ----------
  const e = escapeHtml;
  const muted = "color:#737373;";
  const section = (title: string, body: string) =>
    `<tr><td style="padding:20px 0 0;"><p style="margin:0 0 8px;font-weight:600;font-size:15px;">${title}</p>${body}</td></tr>`;
  const listRow = (left: string, right: string, rightStyle = "") =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #eeeeee;">${left}</td><td style="padding:6px 0;border-bottom:1px solid #eeeeee;text-align:right;white-space:nowrap;${rightStyle}">${right}</td></tr>`;
  const table = (rows: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${rows}</table>`;
  const kpi = (label: string, value: string, color: string, note = "") =>
    `<td style="padding:12px;background:#f5f5f5;border-radius:10px;vertical-align:top;" width="33%"><p style="margin:0;font-size:12px;${muted}">${label}</p><p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${color};">${value}</p>${note}</td>`;

  const parts: string[] = [];
  if (input.count === 0) {
    parts.push(
      `<tr><td style="padding:16px;background:#f5f5f5;border-radius:10px;">Non hai registrato movimenti questa settimana. Se hai speso qualcosa, bastano pochi secondi per aggiungerlo.</td></tr>`,
    );
  } else {
    const note = trend
      ? `<p style="margin:4px 0 0;font-size:12px;color:${trend.good ? "#16a34a" : "#dc2626"};">${e(trend.text)}</p>`
      : "";
    parts.push(
      `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>${kpi("Uscite", e(eur(input.expense)), "#eb6834", note)}${kpi("Entrate", e(eur(input.income)), "#2a78d6")}${kpi("Saldo", e(eur(net)), net >= 0 ? "#16a34a" : "#dc2626")}</tr></table></td></tr>`,
    );
    if (input.topCategories.length) {
      parts.push(
        section(
          "Dove hai speso di più",
          table(input.topCategories.map((c) => listRow(e(c.name), e(eur(c.value)))).join("")),
        ),
      );
    }
  }
  if (input.welfare || input.renewals.length) {
    const notice = (text: string, path: string) =>
      `<p style="margin:0 0 8px;padding:12px 14px;background:#fffbeb;border-radius:10px;font-size:14px;color:#92400e;">${e(text)} <a href="${e(input.appUrl)}${path}" style="color:#92400e;font-weight:600;">Apri</a></p>`;
    parts.push(
      section(
        "Da non perdere",
        [
          input.welfare ? notice(welfareLine(eur, input.welfare), "/ritrovati/radar") : "",
          ...input.renewals.map((r) => notice(renewalLine(r), "/ritrovati/tariffometro")),
        ].join(""),
      ),
    );
  }
  if (input.claims.length) {
    parts.push(
      section(
        "Pratiche da seguire",
        table(
          input.claims
            .map((c) =>
              listRow(
                `<strong>${e(c.counterparty)}</strong> <span style="${muted}font-size:12px;">${e(c.kind)}</span><br><span style="font-size:13px;${c.urgent ? "color:#b45309;" : muted}">${e(c.step)}</span>`,
                `<a href="${e(input.appUrl)}/ritrovati/pratiche/${e(c.id)}" style="color:#047857;font-weight:600;">Apri</a>`,
              ),
            )
            .join(""),
        ),
      ),
    );
  }
  if (input.budgets.length) {
    parts.push(
      section(
        "Budget da tenere d'occhio",
        table(
          input.budgets
            .map((b) =>
              b.status === "over"
                ? listRow(e(b.name), `sforato di ${e(eur(-b.remaining))}`, "color:#dc2626;")
                : listRow(
                    e(b.name),
                    `${Math.round(b.ratio * 100)}% · restano ${e(eur(b.remaining))}`,
                    "color:#b45309;",
                  ),
            )
            .join(""),
        ),
      ),
    );
  }
  if (input.upcoming.length) {
    parts.push(
      section(
        "In arrivo nei prossimi 7 giorni",
        table(
          input.upcoming
            .map((u) =>
              listRow(
                `${e(u.name)} <span style="${muted}font-size:12px;">${e(day(u.date))}</span>`,
                `~ ${e(eur(u.amount))}`,
              ),
            )
            .join(""),
        ),
      ),
    );
  }
  parts.push(
    `<tr><td style="padding:20px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:14px 16px;background:#fff7ed;border-radius:10px;font-size:14px;">🔥 ${e(streakLine(input.streak))}<br><span style="${muted}font-size:12px;">Livello ${input.level.level} · ${e(input.level.name)}</span></td></tr></table></td></tr>`,
    `<tr><td style="padding:24px 0 0;" align="center"><a href="${e(input.appUrl)}/dashboard" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px;">Apri FinTrack</a></td></tr>`,
  );

  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subjectFor(input))}</title></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #eeeeee;border-radius:16px;padding:24px;">
<tr><td><p style="margin:0;font-weight:700;font-size:15px;">FinTrack<span style="color:#2a78d6;">.</span></p>
<h1 style="margin:16px 0 4px;font-size:22px;">La tua settimana</h1>
<p style="margin:0 0 16px;${muted}font-size:14px;">${e(greeting)} ecco com'è andata la settimana ${e(input.weekLabel)}${e(where)}.</p></td></tr>
${parts.join("\n")}
</table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;${muted}">Ricevi questa email perché hai attivato il riepilogo settimanale. <a href="${e(input.unsubscribeUrl)}" style="color:#737373;">Disattivalo</a> quando vuoi, anche dalle impostazioni.</p>
</td></tr></table>
</body></html>`;

  return { subject: subjectFor(input), text: lines.join("\n"), html };
}
