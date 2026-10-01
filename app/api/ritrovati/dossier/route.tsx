import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/auth/session";
import { getActiveSpace } from "@/lib/households";
import { getFoundMoney } from "@/lib/data/found-money";
import { summarizeLines } from "@/lib/finance/deductions";
import { DossierDocument } from "@/lib/found-money/dossier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Rome",
});

// GET /api/ritrovati/dossier?anno=2026&chi=io|tutti: the 730 dossier (FinTrack Pro).
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Non autorizzato", { status: 401 });

  const params = new URL(request.url).searchParams;
  const space = await getActiveSpace(session.user);
  const data = await getFoundMoney(session.user.id, space.id, params.get("anno") ?? undefined);
  if (!data.details) {
    return new Response("Il dossier 730 fa parte di FinTrack Pro.", { status: 402 });
  }

  const everyone = params.get("chi") === "tutti" && data.shared;
  const lines = everyone
    ? data.details.lines
    : data.details.lines.filter((l) => l.memberId === session.user.id);
  const pdf = await renderToBuffer(
    <DossierDocument
      data={{
        year: data.year,
        holder: everyone
          ? `Spazio «${space.name}» (tutte le persone)`
          : session.user.name || session.user.email || "Tu",
        generatedOn: dateFormat.format(new Date()),
        summary: summarizeLines(lines, data.children),
        children: data.children,
      }}
    />,
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fintrack-dossier-730-${data.year + 1}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
