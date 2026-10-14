import { randomUUID } from "crypto";
import { LEGAL } from "@/lib/legal";

type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
  /** The kind of email (verify-email, invite…), to filter them in Resend's dashboard. */
  tag?: string;
};

/**
 * Resend's shared test sender only delivers to the owner of the Resend account: in production
 * every other user would silently get nothing (reset, confirmation, invites, digest).
 */
export const usesTestSender = (from = process.env.EMAIL_FROM) =>
  /@resend\.dev>?\s*$/i.test(from ?? "");

/** Where replies go: the sender is a no-reply address, nobody would read them there. */
export const replyTo = () => process.env.EMAIL_REPLY_TO || LEGAL.email || undefined;

/** What Resend receives: tags may only hold letters, digits, "_" and "-". */
export function resendPayload(from: string, { tag, headers, ...email }: Email) {
  const reply = replyTo();
  return {
    from,
    ...email,
    ...(reply && { reply_to: reply }),
    ...(tag && { tags: [{ name: "type", value: tag.replace(/[^A-Za-z0-9_-]/g, "_") }] }),
    // A different id on every email: Gmail would otherwise fold emails with the same subject
    // (two password resets, two sign-in alerts) into one thread and hide the newest.
    headers: { "X-Entity-Ref-ID": randomUUID(), ...headers },
  };
}

export async function sendEmail(email: Email) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    // Online, printing the email to the logs reaches nobody: fail, so the app doesn't say "sent".
    if (process.env.VERCEL_ENV) {
      throw new Error("[email] RESEND_API_KEY o EMAIL_FROM mancanti: nessuna email può partire");
    }
    console.info(`[email] RESEND_API_KEY non configurata. Email per ${email.to}:\n${email.text}`);
    return;
  }

  if (usesTestSender(from) && process.env.VERCEL_ENV === "production") {
    console.warn(
      "[email] EMAIL_FROM usa il mittente di prova @resend.dev: le email arrivano solo al proprietario dell'account Resend. Verifica un dominio su Resend e aggiorna EMAIL_FROM.",
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(resendPayload(from, email)),
  });
  if (!res.ok) {
    throw new Error(`Invio email fallito (${res.status}): ${await res.text()}`);
  }
}
