import { randomUUID } from "crypto";
import { emailConfigured } from "@/lib/config";

/**
 * Emails to Orbitly users through Resend (same account as the app), with the same settings:
 * replies to EMAIL_REPLY_TO, a tag for Resend's dashboard, no Gmail threading. The design and
 * the wording are the app's (lib/emails/, copied by scripts/sync-admin-schema.mjs).
 */
export async function sendEmail({
  tag,
  ...email
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  tag?: string;
}) {
  if (!emailConfigured())
    throw new Error("Email non configurate (RESEND_API_KEY, EMAIL_FROM, FINTRACK_URL)");
  const replyTo = process.env.EMAIL_REPLY_TO;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      ...email,
      ...(replyTo && { reply_to: replyTo }),
      ...(tag && { tags: [{ name: "type", value: tag.replace(/[^A-Za-z0-9_-]/g, "_") }] }),
      headers: { "X-Entity-Ref-ID": randomUUID() },
    }),
  });
  if (!res.ok) throw new Error(`Invio email fallito (${res.status}): ${await res.text()}`);
}
