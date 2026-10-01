type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
};

/**
 * Resend's shared test sender only delivers to the owner of the Resend account: in production
 * every other user would silently get nothing (reset, confirmation, invites, digest).
 */
export const usesTestSender = (from = process.env.EMAIL_FROM) =>
  /@resend.dev>?s*$/i.test(from ?? "");

export async function sendEmail(email: Email) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
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
    body: JSON.stringify({ from, ...email }),
  });
  if (!res.ok) {
    throw new Error(`Invio email fallito (${res.status}): ${await res.text()}`);
  }
}
