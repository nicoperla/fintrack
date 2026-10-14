// COPY of lib/emails/templates.ts in the app, written by scripts/sync-admin-schema.mjs: don't edit.

import {
  button,
  details,
  divider,
  type EmailTone,
  EMAIL_COLORS,
  escapeHtml,
  fallbackLink,
  features,
  memberPass,
  orbitPair,
  panel,
  paragraph,
  renderEmail,
  sectionTitle,
  textLink,
} from "@/lib/emails/layout";

/*
 * The emails Orbitly sends, each with its subject, the preview line, the HTML in the site's
 * style (lib/emails/layout.ts) and a plain-text twin for clients that don't show HTML. The tag
 * lets Resend's dashboard filter them by kind.
 */

export type EmailContent = { subject: string; text: string; html: string; tag: string };

const owner = () => process.env.LEGAL_OWNER || null;
const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] || null;
const hello = (name?: string | null) => (firstName(name) ? `Ciao ${firstName(name)},` : "Ciao,");
const small = { size: 13, color: EMAIL_COLORS.muted, margin: "0 0 8px" };

const monthYear = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Rome",
});

const FIRST_STEPS = [
  {
    icon: "⚡",
    title: "Scrivi come parli",
    text: "«12 pranzo oggi» o «35 benzina ieri»: importo, categoria e data li capisce da solo.",
  },
  {
    icon: "🔎",
    title: "Soldi ritrovati",
    text: "Rimborsi del 730, abbonamenti dimenticati, doppi addebiti: li cerca mentre registri le spese.",
  },
  {
    icon: "🧭",
    title: "Quanto puoi spendere davvero",
    text: "Lo stipendio vero tiene conto delle spese grosse in arrivo, giorno per giorno.",
  },
];

/** At sign-up (and on request): confirm the address, with the member card and first steps. */
export function verificationEmail({
  appUrl,
  name,
  email,
  link,
  since = new Date(),
}: {
  appUrl: string;
  name?: string | null;
  email: string;
  link: string;
  since?: Date;
}): EmailContent {
  const first = firstName(name);
  const subject = `🪐 ${first ? `${first}, sei` : "Sei"} quasi a bordo: conferma la tua email`;
  const html = renderEmail({
    appUrl,
    title: subject,
    preheader: "Un clic e la tua tessera Orbitly è attiva. Il link vale 48 ore.",
    tone: "violet",
    label: "Iscrizione",
    eyebrow: "Ci siamo quasi",
    heading: first ? `${first}, manca solo un clic` : "Manca solo un clic",
    html: [
      paragraph(
        "Conferma che questo indirizzo è tuo: così potrai invitare chi vive con te, usare il coach AI e recuperare l'account se un giorno dimentichi la password.",
      ),
      memberPass({
        name: name?.trim() ?? "",
        email,
        since: `Da ${monthYear.format(since)}`,
        appUrl,
      }),
      button(link, "Conferma la mia email"),
      paragraph("Il link vale 48 ore.", small),
      fallbackLink(link),
      divider(),
      sectionTitle("Intanto, tre cose da provare"),
      features(FIRST_STEPS),
    ].join("\n"),
    reason:
      "Ricevi questa email perché è stato creato un account Orbitly con questo indirizzo. Se non sei tu, ignorala: senza conferma l'account non può invitare nessuno.",
    owner: owner(),
  });
  const text = [
    hello(name),
    "",
    "conferma il tuo indirizzo aprendo questo link (valido 48 ore):",
    link,
    "",
    "Così potrai invitare chi vive con te, usare il coach AI e recuperare l'account se dimentichi la password.",
    "",
    "Intanto, tre cose da provare su Orbitly:",
    ...FIRST_STEPS.map((s) => `- ${s.title}: ${s.text}`),
    "",
    "Se non hai creato tu l'account, ignora questa email.",
  ].join("\n");
  return { subject, text, html, tag: "verify-email" };
}

/** "Password dimenticata?", or the same link sent by the support from the admin panel. */
export function passwordResetEmail({
  appUrl,
  name,
  link,
}: {
  appUrl: string;
  name?: string | null;
  link: string;
}): EmailContent {
  const subject = "Reimposta la tua password Orbitly";
  const html = renderEmail({
    appUrl,
    title: subject,
    preheader: "Il link per scegliere una nuova password: vale 1 ora.",
    tone: "violet",
    label: "Sicurezza dell'account",
    eyebrow: "Password",
    heading: "Scegli una nuova password",
    html: [
      paragraph(
        `${escapeHtml(hello(name))} abbiamo ricevuto una richiesta per reimpostare la password del tuo account.`,
      ),
      button(link, "Scegli una nuova password"),
      panel(
        `⏱&nbsp; Il link vale <strong style="color:#ffffff;">1 ora</strong> e funziona una volta sola.`,
        { margin: "6px 0 22px" },
      ),
      paragraph(
        "Non l'hai chiesto tu? Ignora questa email: la password resta quella di prima, e senza questo link nessuno può cambiarla.",
        { ...small, size: 14, margin: "0 0 16px" },
      ),
      fallbackLink(link),
    ].join("\n"),
    reason:
      "Ricevi questa email perché è stato chiesto di reimpostare la password del tuo account.",
    owner: owner(),
  });
  const text = [
    hello(name),
    "",
    "per scegliere una nuova password apri questo link (vale 1 ora e funziona una volta sola):",
    link,
    "",
    "Se non l'hai chiesto tu, ignora questa email: la password resta quella di prima.",
  ].join("\n");
  return { subject, text, html, tag: "password-reset" };
}

const TOGETHER = [
  {
    icon: "🏠",
    title: "Vedere gli stessi conti",
    text: "Movimenti, budget e obiettivi in comune, e ognuno registra le sue spese.",
  },
  {
    icon: "🤝",
    title: "Conti chiari",
    text: "Chi ha pagato cosa e chi deve quanto, a metà o in proporzione alle entrate.",
  },
  {
    icon: "☕",
    title: "Il caffè dei conti",
    text: "Ogni mese l'agenda con i vostri numeri, per parlarne con calma.",
  },
  {
    icon: "🔒",
    title: "Il tuo resta tuo",
    text: "Lo spazio personale resta separato: decidi tu cosa mettere in comune.",
  },
];

/** An invitation to a shared space. */
export function inviteEmail({
  appUrl,
  inviter,
  spaceName,
  link,
}: {
  appUrl: string;
  /** Name, or email when the inviter has no name. */
  inviter: string;
  spaceName: string;
  link: string;
}): EmailContent {
  const subject = `${inviter} ti ha invitato su Orbitly`;
  const html = renderEmail({
    appUrl,
    title: subject,
    preheader: `Gestite insieme conti, spese e obiettivi nello spazio «${spaceName}».`,
    tone: "violet",
    label: "Invito",
    eyebrow: "Hai un invito",
    heading: `${inviter} ti invita in «${spaceName}»`,
    html: [
      orbitPair({ name: inviter, label: inviter }, { name: "Tu", label: "Tu" }),
      paragraph(
        `${escapeHtml(firstName(inviter) ?? inviter)} usa Orbitly per tenere i conti di casa e vorrebbe farlo insieme a te. Nello spazio condiviso potrete:`,
      ),
      features(TOGETHER),
      button(link, "Accetta l'invito"),
      paragraph(
        "L'invito vale 7 giorni. Se non hai ancora un account, lo crei in un minuto con questa email.",
        small,
      ),
      fallbackLink(link),
    ].join("\n"),
    reason: `Ricevi questa email perché ${inviter} ti ha invitato. Se non conosci chi te l'ha mandata, ignorala.`,
    owner: owner(),
  });
  const text = [
    `${inviter} ti ha invitato a gestire insieme le finanze nello spazio «${spaceName}» su Orbitly.`,
    "",
    "Nello spazio condiviso potrete:",
    ...TOGETHER.map((t) => `- ${t.title}: ${t.text}`),
    "",
    "Accetta l'invito (valido 7 giorni):",
    link,
  ].join("\n");
  return { subject, text, html, tag: "invite" };
}

export type SignInPlace = { device: string; place: string | null; at?: Date };

const when = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

/** "Safari su iPhone, da Milano, IT, il 9 ottobre 2026 alle ore 10:30". */
export function describePlace({ device, place, at = new Date() }: SignInPlace) {
  return `${device}${place ? `, da ${place}` : ""}, il ${when.format(at)}`;
}

export type SecurityNotice =
  | { kind: "new-device"; where: SignInPlace }
  | { kind: "wrong-code"; where: SignInPlace }
  | { kind: "password-changed" }
  | { kind: "two-factor-on" }
  | { kind: "two-factor-off" }
  | { kind: "recovery-code"; where: SignInPlace; remaining: number };

type Copy = {
  subject: string;
  tone: EmailTone;
  badge: string;
  heading: string;
  /** What happened; with a place, it's followed by ": <where>." in the text version. */
  lead: string;
  after: string[];
  action: string;
};

function securityCopy(notice: SecurityNotice): Copy {
  switch (notice.kind) {
    case "new-device":
      return {
        subject: "Nuovo accesso al tuo account Orbitly",
        tone: "amber",
        badge: "Nuovo accesso",
        heading: "Un nuovo dispositivo è entrato nel tuo account",
        lead: "È stato fatto un accesso al tuo account da un dispositivo che non avevamo mai visto",
        after: ["Se eri tu, non devi fare niente."],
        action: "Non ero io",
      };
    case "wrong-code":
      return {
        subject: "Qualcuno conosce la tua password Orbitly",
        tone: "rose",
        badge: "Accesso bloccato",
        heading: "Abbiamo fermato un accesso al tuo account",
        lead: "Qualcuno ha inserito la password giusta del tuo account, ma codici di verifica sbagliati",
        after: [
          "La verifica in due passaggi l'ha fermato. Se non eri tu, la tua password non è più segreta: cambiala adesso.",
        ],
        action: "Cambia subito la password",
      };
    case "password-changed":
      return {
        subject: "La tua password Orbitly è cambiata",
        tone: "emerald",
        badge: "Password cambiata",
        heading: "La tua password è stata cambiata",
        lead: "La password del tuo account è appena stata cambiata, e abbiamo chiuso le sessioni aperte sugli altri dispositivi.",
        after: [],
        action: "Non ero io",
      };
    case "two-factor-on":
      return {
        subject: "Verifica in due passaggi attivata",
        tone: "emerald",
        badge: "Protezione attiva",
        heading: "Il tuo account ora ha una doppia serratura",
        lead: "Da ora, per entrare in Orbitly servono la password e il codice dell'app di autenticazione.",
        after: ["Tieni i codici di recupero in un posto sicuro: servono se perdi il telefono."],
        action: "Non ero io",
      };
    case "two-factor-off":
      return {
        subject: "Verifica in due passaggi disattivata",
        tone: "amber",
        badge: "Protezione disattivata",
        heading: "La verifica in due passaggi è spenta",
        lead: "La verifica in due passaggi del tuo account è stata disattivata: per entrare basta di nuovo la password.",
        after: [],
        action: "Non ero io",
      };
    case "recovery-code":
      return {
        subject: "Hai usato un codice di recupero",
        tone: "amber",
        badge: "Codice di recupero usato",
        heading: "È stato usato un codice di recupero",
        lead: "Per entrare nel tuo account è stato usato un codice di recupero",
        after: [
          notice.remaining > 0
            ? `Ti ${notice.remaining === 1 ? "resta 1 codice" : `restano ${notice.remaining} codici`}. Se hai perso il telefono, da Impostazioni › Sicurezza disattiva e riattiva la verifica in due passaggi per collegare quello nuovo.`
            : "Non ti restano codici di recupero: creane di nuovi da Impostazioni › Sicurezza.",
        ],
        action: "Non ero io",
      };
  }
}

/** Security notices: they say what happened, where and when, and the way out. */
export function securityEmail(
  notice: SecurityNotice,
  { appUrl, name }: { appUrl: string; name?: string | null },
): EmailContent {
  const copy = securityCopy(notice);
  const where = "where" in notice ? notice.where : null;
  const resetLink = `${appUrl}/forgot-password`;
  const settingsLink = `${appUrl}/settings#sicurezza`;
  const leadText = where ? `${copy.lead}: ${describePlace(where)}.` : copy.lead;

  const placeRows: [string, string][] = where
    ? [
        ["Dispositivo", where.device],
        ...(where.place ? ([["Luogo", where.place]] as [string, string][]) : []),
        ["Quando", when.format(where.at ?? new Date())],
      ]
    : [];
  const html = renderEmail({
    appUrl,
    title: copy.subject,
    preheader: where ? `${where.device}${where.place ? ` · ${where.place}` : ""}` : copy.lead,
    tone: copy.tone,
    label: "Sicurezza dell'account",
    badge: copy.badge,
    heading: copy.heading,
    html: [
      paragraph(escapeHtml(hello(name)), { margin: "0 0 8px" }),
      paragraph(escapeHtml(where ? `${copy.lead}.` : copy.lead)),
      where ? details(placeRows) : "",
      ...copy.after.map((line) => paragraph(escapeHtml(line))),
      panel(
        `<strong style="color:#ffffff;">Non eri tu?</strong> Reimposta subito la password: chi è entrato resterà fuori. Poi controlla la verifica in due passaggi e i dispositivi da ${textLink(settingsLink, "Impostazioni › Sicurezza")}.`,
        { tone: "rose", margin: "24px 0 0" },
      ),
      button(resetLink, copy.action, "danger"),
    ].join("\n"),
    reason:
      "Ti scriviamo per ogni cambiamento importante alla sicurezza del tuo account: questi avvisi non si possono disattivare.",
    owner: owner(),
  });
  const text = [
    hello(name),
    "",
    leadText,
    ...copy.after,
    "",
    `Se non eri tu, reimposta subito la password: ${resetLink}`,
    `Poi controlla la verifica in due passaggi e i dispositivi da Impostazioni › Sicurezza: ${settingsLink}`,
  ].join("\n");
  return { subject: copy.subject, text, html, tag: `security-${notice.kind}` };
}

/** Sent from the admin panel when the support turns off someone's 2FA at their request. */
export function supportTwoFactorResetEmail({
  appUrl,
  name,
}: {
  appUrl: string;
  name?: string | null;
}): EmailContent {
  const subject = "Verifica in due passaggi disattivata dall'assistenza";
  const settingsLink = `${appUrl}/settings#sicurezza`;
  const html = renderEmail({
    appUrl,
    title: subject,
    preheader: "Accedi con la password e riattivala da Impostazioni › Sicurezza.",
    tone: "amber",
    label: "Sicurezza dell'account",
    badge: "Intervento dell'assistenza",
    heading: "Abbiamo disattivato la verifica in due passaggi",
    html: [
      paragraph(escapeHtml(hello(name)), { margin: "0 0 8px" }),
      paragraph(
        "su tua richiesta l'assistenza di Orbitly ha disattivato la verifica in due passaggi del tuo account e chiuso le sessioni aperte. Accedi con la password e riattivala: bastano due minuti.",
      ),
      button(settingsLink, "Riattivala adesso"),
      panel(
        `<strong style="color:#ffffff;">Non l'hai chiesto tu?</strong> Rispondi subito a questa email: mettiamo l'account al sicuro.`,
        { tone: "rose", margin: "10px 0 0" },
      ),
    ].join("\n"),
    reason: "Ti scriviamo per ogni cambiamento importante alla sicurezza del tuo account.",
    owner: owner(),
  });
  const text = [
    hello(name),
    "",
    "su tua richiesta l'assistenza di Orbitly ha disattivato la verifica in due passaggi del tuo account e chiuso le sessioni aperte. Accedi con la password e riattivala da Impostazioni › Sicurezza:",
    settingsLink,
    "",
    "Se non l'hai chiesto tu, rispondi subito a questa email.",
  ].join("\n");
  return { subject, text, html, tag: "support-two-factor-reset" };
}
