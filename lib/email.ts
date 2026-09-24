type Email = { to: string; subject: string; text: string; html: string };

export async function sendEmail(email: Email) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.info(`[email] RESEND_API_KEY non configurata. Email per ${email.to}:\n${email.text}`);
    return;
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
