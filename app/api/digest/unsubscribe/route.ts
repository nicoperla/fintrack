import { prisma } from "@/lib/db/prisma";
import { escapeHtml } from "@/lib/reports/digest";
import { verifyUnsubscribeToken } from "@/lib/reports/unsubscribe";
import { getAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The page behind the link in the digest: the same night sky and card as the email itself.
function page(title: string, body: string, status = 200) {
  const appUrl = escapeHtml(getAppUrl());
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="dark"><title>${escapeHtml(title)} · Orbitly</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05050c url('${appUrl}/email-assets/stars.png?v=1');color:#c4c6dc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:16px;box-sizing:border-box}
.logo{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 20px;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.02em;text-decoration:none}
main{max-width:420px;background:#0d0d1d;border:1px solid #24243f;border-radius:24px;padding:32px 28px;text-align:center;box-shadow:0 30px 80px -40px rgba(124,58,237,.6)}
h1{color:#fff;font-size:21px;letter-spacing:-0.01em;margin:0 0 10px}p{color:#8b8ca8;font-size:14px;line-height:1.6;margin:0 0 22px}
button,a.btn{display:inline-block;background:#7c3aed linear-gradient(135deg,#4f46e5,#7c3aed 55%,#a21caf);color:#fff;border:0;border-radius:12px;padding:13px 22px;font-size:15px;font-weight:700;text-decoration:none;cursor:pointer;box-shadow:0 12px 32px -12px rgba(139,92,246,.9)}</style></head>
<body><div><a class="logo" href="${appUrl}"><img src="${appUrl}/email-assets/logo.png?v=1" width="30" height="30" alt="">Orbitly</a><main><h1>${escapeHtml(title)}</h1>${body}</main></div></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function readParams(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  return userId && token && verifyUnsubscribeToken(userId, token) ? { userId, url } : null;
}

const invalid = () =>
  page(
    "Link non valido",
    `<p>Il link è incompleto o non è più valido. Puoi disattivare il riepilogo dalle impostazioni di Orbitly.</p><a class="btn" href="${escapeHtml(getAppUrl())}/settings">Vai alle impostazioni</a>`,
    400,
  );

// GET only asks for confirmation: mail scanners follow links, and must not unsubscribe anyone.
export async function GET(request: Request) {
  const params = readParams(request);
  if (!params) return invalid();
  const action = `${params.url.pathname}${params.url.search}`;
  return page(
    "Disattivare il riepilogo settimanale?",
    `<p>Non riceverai più l'email del lunedì con la tua settimana in numeri. Potrai riattivarla quando vuoi dalle impostazioni.</p><form method="post" action="${escapeHtml(action)}"><button type="submit">Sì, disattiva</button></form>`,
  );
}

// POST confirms, both from the page above and from one-click unsubscribe (RFC 8058).
export async function POST(request: Request) {
  const params = readParams(request);
  if (!params) return invalid();
  await prisma.user.updateMany({ where: { id: params.userId }, data: { weeklyDigest: false } });
  return page(
    "Fatto, riepilogo disattivato",
    `<p>Non riceverai più il riepilogo settimanale. Se cambi idea, lo trovi nelle impostazioni.</p><a class="btn" href="${escapeHtml(getAppUrl())}/settings">Vai alle impostazioni</a>`,
  );
}
