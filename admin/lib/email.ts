import { emailConfigured } from "@/lib/config";

/** Emails to FinTrack users through Resend (same account as the app). */
export async function sendEmail(email: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  if (!emailConfigured())
    throw new Error("Email non configurate (RESEND_API_KEY, EMAIL_FROM, FINTRACK_URL)");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, ...email }),
  });
  if (!res.ok) throw new Error(`Invio email fallito (${res.status}): ${await res.text()}`);
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
