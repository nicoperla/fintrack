import { getAppUrl } from "@/lib/app-url";
import {
  type EmailContent,
  inviteEmail,
  passwordResetEmail,
  securityEmail,
  supportTwoFactorResetEmail,
  verificationEmail,
} from "@/lib/emails/templates";
import { buildWeeklyDigest } from "@/lib/reports/digest";

export const dynamic = "force-dynamic";

/*
 * Only on `next dev`: every email with sample data, to look at them while working on the
 * design. /api/dev/emails lists them, ?t=<name> shows one, &text=1 its plain-text version.
 */

const where = { device: "Safari su iPhone", place: "Milano, IT", at: new Date() };

function samples(appUrl: string): Record<string, () => EmailContent> {
  const name = "Giulia Bianchi";
  return {
    "verify-email": () =>
      verificationEmail({
        appUrl,
        name,
        email: "giulia.bianchi@gmail.com",
        link: `${appUrl}/verify-email?token=esempio`,
      }),
    "password-reset": () =>
      passwordResetEmail({ appUrl, name, link: `${appUrl}/reset-password?token=esempio` }),
    invite: () =>
      inviteEmail({
        appUrl,
        inviter: "Marco Rossi",
        spaceName: "Casa Rossi",
        link: `${appUrl}/invite/esempio`,
      }),
    "security-new-device": () => securityEmail({ kind: "new-device", where }, { appUrl, name }),
    "security-wrong-code": () => securityEmail({ kind: "wrong-code", where }, { appUrl, name }),
    "security-password-changed": () =>
      securityEmail({ kind: "password-changed" }, { appUrl, name }),
    "security-two-factor-on": () => securityEmail({ kind: "two-factor-on" }, { appUrl, name }),
    "security-two-factor-off": () => securityEmail({ kind: "two-factor-off" }, { appUrl, name }),
    "security-recovery-code": () =>
      securityEmail({ kind: "recovery-code", where, remaining: 3 }, { appUrl, name }),
    "support-two-factor-reset": () => supportTwoFactorResetEmail({ appUrl, name }),
    "weekly-digest": () => ({
      ...buildWeeklyDigest({
        name,
        weekLabel: "dal 5 all'11 ottobre",
        income: 1850,
        expense: 412.6,
        previousExpense: 498.3,
        count: 23,
        topCategories: [
          { name: "Spesa", value: 168.4 },
          { name: "Ristoranti e bar", value: 96.5 },
          { name: "Trasporti", value: 61.2 },
          { name: "Svago", value: 38 },
        ],
        budgets: [
          { name: "Ristoranti e bar", ratio: 0.86, status: "warning", remaining: 33.5 },
          { name: "Shopping", ratio: 1.12, status: "over", remaining: -18 },
        ],
        upcoming: [
          { name: "Netflix", amount: 12.99, date: "2026-10-16" },
          { name: "Palestra FitLife", amount: 39, date: "2026-10-18" },
        ],
        claims: [
          {
            id: "esempio",
            counterparty: "FitLife",
            kind: "Disdetta",
            step: "Scade il termine per la risposta: manda il sollecito",
            urgent: true,
          },
        ],
        welfare: { balance: 250, expiresOn: "2026-10-31", days: 17 },
        renewals: [{ kind: "CAR_INSURANCE", label: "Panda", date: "2026-11-02", days: 19 }],
        talk: { monthName: "settembre" },
        pacts: [
          { category: "Ristoranti", state: "active", used: 0.7, daysLeft: 9, finePending: false },
        ],
        streak: { current: 12, longest: 12 },
        level: { level: 4, name: "Organizzato" },
        appUrl,
        unsubscribeUrl: `${appUrl}/api/digest/unsubscribe?u=esempio&t=esempio`,
      }),
      tag: "weekly-digest",
    }),
  };
}

export function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const all = samples(getAppUrl());
  const pick = url.searchParams.get("t");
  const email = pick ? all[pick]?.() : null;
  if (email) {
    return url.searchParams.get("text")
      ? new Response(`Oggetto: ${email.subject}\n\n${email.text}`, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      : new Response(email.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const links = Object.entries(all)
    .map(([key, build]) => {
      const { subject } = build();
      return `<li><a href="?t=${key}">${key}</a> <span>${subject.replace(/</g, "&lt;")}</span> <a href="?t=${key}&text=1">testo</a></li>`;
    })
    .join("");
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Email di Orbitly</title><style>body{background:#05050c;color:#c4c6dc;font:15px system-ui;padding:32px}a{color:#c4b5fd}li{margin:8px 0}span{color:#8b8ca8;margin:0 8px}</style><h1 style="color:#fff">Email di Orbitly</h1><ul>${links}</ul>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
