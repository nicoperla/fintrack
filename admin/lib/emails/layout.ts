// COPY of lib/emails/layout.ts in the app, written by scripts/sync-admin-schema.mjs: don't edit.

/*
 * Orbitly's email design: the night sky of the landing page, a dark card with a planet on top,
 * the violet button. Written the way email clients want it: tables, inline styles and a solid
 * colour behind every gradient (Outlook on Windows shows the colour, the others the gradient).
 *
 * No imports: the admin panel uses a copy of this file (admin/lib/email-layout.ts, written by
 * scripts/sync-admin-schema.mjs). Arguments named `html` are trusted; every other string is
 * escaped here.
 */

export const EMAIL_TONES = ["violet", "amber", "emerald", "rose"] as const;
/** The colour of an email: violet for news, amber to check something, emerald when all is
 * well, rose for an alarm. It picks the picture on top and the accents. */
export type EmailTone = (typeof EMAIL_TONES)[number];

/** Bump when the pictures change: email clients keep them for a long time. */
const ASSET_VERSION = 1;

export const EMAIL_COLORS = {
  page: "#05050c",
  card: "#0d0d1d",
  cardBorder: "#24243f",
  panel: "#15152b",
  panelBorder: "#2a2a4a",
  heading: "#ffffff",
  text: "#c4c6dc",
  muted: "#8b8ca8",
  faint: "#686a88",
  link: "#c4b5fd",
  good: "#34d399",
  bad: "#fb7185",
  warn: "#fbbf24",
} as const;
const C = EMAIL_COLORS;

const TONES: Record<EmailTone, { accent: string; badge: string }> = {
  violet: { accent: "#c4b5fd", badge: "#231d45" },
  amber: { accent: "#fbbf24", badge: "#2e2410" },
  emerald: { accent: "#34d399", badge: "#0f2a22" },
  rose: { accent: "#fb7185", badge: "#33141e" },
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const e = escapeHtml;

/** A picture served by the app (lib/emails/assets.tsx), with an absolute URL. */
export const emailAsset = (appUrl: string, name: string) =>
  `${appUrl}/email-assets/${name}?v=${ASSET_VERSION}`;

export function paragraph(
  html: string,
  { size = 16, color = C.text as string, margin = "0 0 16px" } = {},
) {
  return `<p style="margin:${margin};font-family:${FONT};font-size:${size}px;line-height:1.6;color:${color};">${html}</p>`;
}

/** A link inside the text, in the brand's light violet. */
export const textLink = (href: string, label: string) =>
  `<a href="${e(href)}" target="_blank" style="color:${C.link};text-decoration:underline;">${e(label)}</a>`;

const BUTTONS = {
  primary: {
    color: "#7c3aed",
    gradient: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#a21caf 100%)",
    shadow: "0 12px 32px -12px rgba(139,92,246,0.9)",
  },
  danger: {
    color: "#e11d48",
    gradient: "linear-gradient(135deg,#fb7185 0%,#e11d48 55%,#9f1239 100%)",
    shadow: "0 12px 32px -12px rgba(244,63,94,0.8)",
  },
};

/** The big call to action: the gradient of the site's buttons, a solid colour underneath. */
export function button(href: string, label: string, kind: keyof typeof BUTTONS = "primary") {
  const b = BUTTONS[kind];
  return `<table ${TABLE} style="margin:28px 0 14px;"><tr><td align="center" bgcolor="${b.color}" style="border-radius:14px;background-color:${b.color};background-image:${b.gradient};box-shadow:${b.shadow};"><a href="${e(href)}" target="_blank" style="display:inline-block;padding:16px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:14px;">${e(label)}&nbsp;&rarr;</a></td></tr></table>`;
}

/** Under a button: the same address in full, for clients that block buttons or links. */
export const fallbackLink = (url: string) =>
  paragraph(
    `Se il pulsante non funziona, copia questo indirizzo nel browser:<br><a href="${e(url)}" target="_blank" style="color:${C.link};word-break:break-all;">${e(url)}</a>`,
    { size: 12, color: C.faint, margin: "0" },
  );

/** A rounded box, lighter than the card; with a tone, a coloured edge on the left. */
export function panel(
  html: string,
  { tone, margin = "24px 0" }: { tone?: EmailTone; margin?: string } = {},
) {
  const edge = tone ? `border-left:3px solid ${TONES[tone].accent};` : "";
  return `<table ${TABLE} width="100%" style="margin:${margin};"><tr><td bgcolor="${C.panel}" style="background-color:${C.panel};border:1px solid ${C.panelBorder};${edge}border-radius:16px;padding:18px 20px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.text};">${html}</td></tr></table>`;
}

/** Label and value pairs in a box: device, place and time of a sign-in, and the like. */
export function details(rows: [label: string, value: string][]) {
  const body = rows
    .map(
      ([label, value], i) =>
        `<tr><td style="padding:${i ? "14px" : "0"} 0 0;font-family:${FONT};"><p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.faint};">${e(label)}</p><p style="margin:3px 0 0;font-size:15px;line-height:1.4;color:${C.heading};">${e(value)}</p></td></tr>`,
    )
    .join("");
  return panel(`<table ${TABLE} width="100%">${body}</table>`);
}

/** A small coloured pill above the title: "Nuovo accesso", "Protezione attiva"… */
export function badge(text: string, tone: EmailTone) {
  const t = TONES[tone];
  return `<table ${TABLE} style="margin:0 0 14px;"><tr><td bgcolor="${t.badge}" style="background-color:${t.badge};border-radius:999px;padding:6px 12px;font-family:${FONT};font-size:12px;font-weight:700;line-height:14px;color:${t.accent};">&#9679;&nbsp;${e(text)}</td></tr></table>`;
}

/** Small uppercase title of a section. */
export const sectionTitle = (text: string) =>
  `<p style="margin:0 0 14px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.muted};">${e(text)}</p>`;

export const divider = () =>
  `<table ${TABLE} width="100%" style="margin:32px 0 28px;"><tr><td height="1" bgcolor="${C.cardBorder}" style="height:1px;line-height:1px;font-size:0;background-color:${C.cardBorder};">&nbsp;</td></tr></table>`;

/** A list with an icon (an emoji) in a rounded square, a title and a line of text. */
export function features(items: { icon: string; title: string; text: string }[]) {
  const rows = items
    .map(
      (item) =>
        `<tr><td width="54" valign="top" style="padding:0 0 18px;"><table ${TABLE}><tr><td width="40" height="40" align="center" valign="middle" bgcolor="#1c1c38" style="width:40px;height:40px;background-color:#1c1c38;border:1px solid ${C.panelBorder};border-radius:12px;font-size:19px;line-height:40px;">${item.icon}</td></tr></table></td><td valign="top" style="padding:1px 0 18px;font-family:${FONT};"><p style="margin:0;font-size:15px;font-weight:700;line-height:1.4;color:${C.heading};">${e(item.title)}</p><p style="margin:2px 0 0;font-size:14px;line-height:1.5;color:${C.muted};">${e(item.text)}</p></td></tr>`,
    )
    .join("");
  return `<table ${TABLE} width="100%" style="margin:4px 0 0;">${rows}</table>`;
}

const AVATAR_GRADIENT = "linear-gradient(135deg,#e0e7ff 0%,#c4b5fd 50%,#f0abfc 100%)";

function avatar(initial: string, size: number) {
  return `<table ${TABLE}><tr><td width="${size}" height="${size}" align="center" valign="middle" bgcolor="#c4b5fd" style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background-color:#c4b5fd;background-image:${AVATAR_GRADIENT};font-family:${FONT};font-size:${Math.round(size * 0.42)}px;font-weight:700;line-height:${size}px;color:#3b0764;">${e(initial)}</td></tr></table>`;
}

const initialOf = (text: string) => (text.trim()[0] ?? "?").toUpperCase();

/**
 * The Orbitly card the user saw filling in while signing up (components/register/
 * member-pass.tsx), now with their name on it.
 */
export function memberPass({
  name,
  email,
  since,
  appUrl,
}: {
  name: string;
  email: string;
  /** e.g. "Da ottobre 2026". */
  since: string;
  appUrl: string;
}) {
  const small = `font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#ddd6fe;`;
  return `<table ${TABLE} width="100%" style="margin:26px 0 6px;"><tr><td bgcolor="#5b3fd6" style="background-color:#5b3fd6;background-image:linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#a21caf 100%);border-radius:20px;padding:20px 22px;box-shadow:0 18px 40px -18px rgba(124,58,237,0.9);">
<table ${TABLE} width="100%"><tr><td width="48" valign="middle">${avatar(initialOf(name || email), 48)}</td><td valign="middle" style="padding-left:14px;font-family:${FONT};"><p style="margin:0;font-size:18px;font-weight:700;line-height:1.3;color:#ffffff;">${e(name || "Il tuo account")}</p><p style="margin:2px 0 0;font-size:13px;line-height:1.4;color:#e0e7ff;"><span style="color:#e0e7ff;text-decoration:none;">${e(email)}</span></p></td><td width="32" align="right" valign="top"><img src="${e(emailAsset(appUrl, "logo.png"))}" width="32" height="32" alt="" style="display:block;border:0;"></td></tr></table>
<table ${TABLE} width="100%" style="margin-top:18px;"><tr><td style="${small}">Tessera Orbitly</td><td align="right" style="${small}">${e(since)}</td></tr></table>
</td></tr></table>`;
}

/** Two people linked by an orbit: who invites and who is invited. */
export function orbitPair(
  left: { name: string; label: string },
  right: { name: string; label: string },
) {
  const person = (p: { name: string; label: string }) =>
    `<td width="110" align="center" valign="top" style="font-family:${FONT};">${avatar(initialOf(p.name), 64)}<p style="margin:10px 0 0;font-size:13px;line-height:1.4;color:${C.muted};">${e(p.label)}</p></td>`;
  const line = `<td valign="top" style="padding-top:24px;"><table ${TABLE} width="100%"><tr><td height="8" style="height:8px;border-bottom:2px dashed #4c3fa3;font-size:0;line-height:0;">&nbsp;</td><td width="16" align="center" valign="middle"><table ${TABLE}><tr><td width="16" height="16" bgcolor="#67e8f9" style="width:16px;height:16px;border-radius:8px;background-color:#67e8f9;box-shadow:0 0 12px #67e8f9;font-size:0;line-height:0;">&nbsp;</td></tr></table></td><td height="8" style="height:8px;border-bottom:2px dashed #4c3fa3;font-size:0;line-height:0;">&nbsp;</td></tr></table></td>`;
  return `<table ${TABLE} width="100%" style="margin:26px 0 10px;"><tr>${person(left)}${line}${person(right)}</tr></table>`;
}

/** Big numbers side by side (they stack on phones). */
export function kpis(
  items: { label: string; value: string; color: string; note?: string; noteColor?: string }[],
) {
  const width = Math.floor(100 / items.length);
  const cells = items
    .map(
      (k) =>
        `<td class="o-stack" width="${width}%" valign="top" style="padding:4px;"><table ${TABLE} width="100%"><tr><td bgcolor="${C.panel}" style="background-color:${C.panel};border:1px solid ${C.panelBorder};border-radius:14px;padding:14px 16px;font-family:${FONT};"><p style="margin:0;font-size:12px;color:${C.muted};">${e(k.label)}</p><p style="margin:4px 0 0;font-size:21px;font-weight:700;line-height:1.2;color:${k.color};">${e(k.value)}</p>${k.note ? `<p style="margin:4px 0 0;font-size:12px;line-height:1.4;color:${k.noteColor ?? C.muted};">${e(k.note)}</p>` : ""}</td></tr></table></td>`,
    )
    .join("");
  return `<table ${TABLE} width="100%" style="margin:16px 0 4px;"><tr>${cells}</tr></table>`;
}

/** Labels with their amount and a bar as long as their share of the largest one. */
export function bars(items: { label: string; value: string; ratio: number }[]) {
  const body = items
    .map((b) => {
      const pct = Math.min(100, Math.max(4, Math.round(b.ratio * 100)));
      return `<tr><td style="padding:12px 0 0;font-family:${FONT};"><table ${TABLE} width="100%"><tr><td style="font-family:${FONT};font-size:14px;line-height:1.4;color:${C.text};">${e(b.label)}</td><td align="right" style="font-family:${FONT};font-size:14px;font-weight:700;line-height:1.4;white-space:nowrap;color:${C.heading};">${e(b.value)}</td></tr></table><table ${TABLE} width="100%" style="margin-top:7px;"><tr><td bgcolor="#1c1c38" style="background-color:#1c1c38;border-radius:4px;font-size:0;line-height:0;"><table ${TABLE} width="${pct}%"><tr><td height="6" bgcolor="#a78bfa" style="height:6px;border-radius:4px;background-color:#a78bfa;background-image:linear-gradient(90deg,#818cf8 0%,#a78bfa 50%,#e879f9 100%);font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table></td></tr>`;
    })
    .join("");
  return `<table ${TABLE} width="100%">${body}</table>`;
}

/** Rows with text on the left and an amount or a link on the right. */
export function rows(items: { left: string; right: string; rightColor?: string }[]) {
  const body = items
    .map(
      (r) =>
        `<tr><td valign="top" style="padding:11px 12px 11px 0;border-bottom:1px solid ${C.cardBorder};font-family:${FONT};font-size:14px;line-height:1.5;color:${C.text};">${r.left}</td><td valign="top" align="right" style="padding:11px 0;border-bottom:1px solid ${C.cardBorder};font-family:${FONT};font-size:14px;line-height:1.5;white-space:nowrap;color:${r.rightColor ?? C.heading};">${r.right}</td></tr>`,
    )
    .join("");
  return `<table ${TABLE} width="100%">${body}</table>`;
}

export type EmailFrame = {
  appUrl: string;
  /** The <title>, usually the subject. */
  title: string;
  /** The grey line next to the subject in the inbox. */
  preheader: string;
  tone: EmailTone;
  /** Small text in the header, on the right: what kind of email this is. */
  label: string;
  eyebrow?: string;
  /** A coloured pill above the title, in place of the eyebrow: "Nuovo accesso"… */
  badge?: string;
  heading: string;
  /** The content of the card, built with the functions above. */
  html: string;
  /** Why the person receives this email (escaped). */
  reason: string;
  /** Who runs Orbitly (LEGAL_OWNER), when set. */
  owner?: string | null;
  /** Extra footer content, trusted (e.g. the digest's unsubscribe link). */
  footerHtml?: string;
};

/** The whole email: background, header with the logo, the card with the picture, the footer. */
export function renderEmail(f: EmailFrame) {
  const accent = TONES[f.tone].accent;
  // Keeps the inbox preview to the preheader instead of the first words of the body.
  const spacer = "&#847;&zwnj;&nbsp;".repeat(70);
  const footerLink = (path: string, label: string) =>
    `<a href="${e(f.appUrl + path)}" target="_blank" style="color:${C.muted};text-decoration:underline;">${label}</a>`;
  return `<!doctype html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${e(f.title)}</title>
<style>
:root{color-scheme:dark light;supported-color-schemes:dark light;}
body{margin:0!important;padding:0!important;width:100%!important;background-color:${C.page};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important;}
@media screen and (max-width:620px){
.o-outer{padding:20px 10px!important;}
.o-px{padding-left:22px!important;padding-right:22px!important;}
.o-h1{font-size:25px!important;}
.o-stack{display:block!important;width:100%!important;}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.page};" bgcolor="${C.page}">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${e(f.preheader)}${spacer}</div>
<table ${TABLE} width="100%" bgcolor="${C.page}" background="${e(emailAsset(f.appUrl, "stars.png"))}" style="background-color:${C.page};background-image:url('${e(emailAsset(f.appUrl, "stars.png"))}');background-repeat:repeat;">
<tr><td class="o-outer" align="center" style="padding:36px 16px;">
<table ${TABLE} width="100%" style="max-width:600px;">
<tr><td style="padding:0 6px 22px;">
<table ${TABLE} width="100%"><tr>
<td valign="middle"><a href="${e(f.appUrl)}" target="_blank" style="text-decoration:none;"><table ${TABLE}><tr><td valign="middle"><img src="${e(emailAsset(f.appUrl, "logo.png"))}" width="30" height="30" alt="" style="display:block;border:0;"></td><td valign="middle" style="padding-left:10px;font-family:${FONT};font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">Orbitly</td></tr></table></a></td>
<td align="right" valign="middle" style="font-family:${FONT};font-size:12px;color:${C.muted};">${e(f.label)}</td>
</tr></table>
</td></tr>
<tr><td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.cardBorder};border-radius:24px;">
<img src="${e(emailAsset(f.appUrl, `hero-${f.tone}.png`))}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:24px 24px 0 0;">
<table ${TABLE} width="100%"><tr><td class="o-px" style="padding:0 40px 40px;">
${f.badge ? badge(f.badge, f.tone) : ""}
${f.eyebrow && !f.badge ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${accent};">${e(f.eyebrow)}</p>` : ""}
<h1 class="o-h1" style="margin:0 0 16px;font-family:${FONT};font-size:29px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${C.heading};">${e(f.heading)}</h1>
${f.html}
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:28px 20px 8px;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.faint};">
<p style="margin:0 0 6px;font-weight:700;color:${C.muted};">Orbitly &middot; I tuoi soldi, finalmente chiari</p>
<p style="margin:0 0 6px;">${e(f.reason)}</p>
${f.footerHtml ? `<p style="margin:0 0 6px;">${f.footerHtml}</p>` : ""}
<p style="margin:0;">${footerLink("/settings", "Impostazioni")} &middot; ${footerLink("/privacy", "Privacy")}${f.owner ? ` &middot; ${e(f.owner)}` : ""} &middot; Fatto in Italia</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
