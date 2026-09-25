import { prisma } from "@/lib/db/prisma";
import { escapeHtml } from "@/lib/reports/digest";
import { verifyUnsubscribeToken } from "@/lib/reports/unsubscribe";
import { getAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} · FinTrack</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fafafa;color:#171717;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:16px;box-sizing:border-box}
main{max-width:420px;background:#fff;border:1px solid #eee;border-radius:16px;padding:28px;text-align:center}
h1{font-size:20px;margin:0 0 8px}p{color:#737373;font-size:14px;line-height:1.5;margin:0 0 20px}
button,a.btn{display:inline-block;background:#171717;color:#fff;border:0;border-radius:10px;padding:11px 20px;font-size:14px;font-weight:600;text-decoration:none;cursor:pointer}
@media (prefers-color-scheme:dark){body{background:#0a0a0a;color:#fafafa}main{background:#171717;border-color:#262626}p{color:#a3a3a3}button,a.btn{background:#fafafa;color:#171717}}</style></head>
<body><main><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`;
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
    `<p>Il link è incompleto o non è più valido. Puoi disattivare il riepilogo dalle impostazioni di FinTrack.</p><a class="btn" href="${escapeHtml(getAppUrl())}/settings">Vai alle impostazioni</a>`,
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
