import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/auth/session";
import { getActiveSpace } from "@/lib/households";
import { getMy730 } from "@/lib/data/my730";
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

// GET /api/730/promemoria?anno=2026: "Il mio 730" as a personal reminder in PDF (Orbitly Pro).
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Non autorizzato", { status: 401 });

  const params = new URL(request.url).searchParams;
  const space = await getActiveSpace(session.user);
  const data = await getMy730(session.user.id, space.id, params.get("anno") ?? undefined);
  if (!data.lines) {
    return new Response("Il promemoria del 730 fa parte di Orbitly Pro.", { status: 402 });
  }

  const caf = data.decision === "CAF" || data.channel === "CAF";
  const c = data.rules.calendar;
  const pdf = await renderToBuffer(
    <DossierDocument
      data={{
        year: data.year,
        holder: session.user.name || session.user.email || "Tu",
        generatedOn: dateFormat.format(new Date()),
        summary: summarizeLines(data.lines, data.children, { marginalRate: data.marginal }),
        children: data.children,
        guide: {
          next: data.next,
          light: data.assessment
            ? { title: data.assessment.title, reasons: data.assessment.reasons }
            : null,
          dates: [
            { label: "Certificazione Unica (entro)", date: c.cu },
            { label: "Esce il precompilato", date: c.precompiled },
            { label: "Si può inviare da", date: c.sendFrom },
            { label: "Per il rimborso a luglio, invia entro", date: data.rules.refunds[0].sentBy },
            { label: "Scadenza del 730", date: c.deadline },
          ].filter((d) => d.date >= data.today),
          documents: data.documents
            .filter((d) => caf || !d.cafOnly)
            .map((d) => ({
              label: d.label,
              detail: d.detail,
              state: data.docStates[d.key] ?? "todo",
              cafOnly: Boolean(d.cafOnly),
            })),
          marginal: data.marginal,
        },
      }}
    />,
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="orbitly-il-mio-730-${data.year + 1}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
