import { getSession } from "@/lib/auth/session";
import { getDigestInput } from "@/lib/data/digest";
import { buildWeeklyDigest } from "@/lib/reports/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shows the logged-in user the email they would receive next Monday.
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Non autorizzato", { status: 401 });
  const { html } = buildWeeklyDigest(await getDigestInput(session.user.id));
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
