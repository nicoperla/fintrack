import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/auth/session";
import { getReportData, parseReportPeriod } from "@/lib/reports/data";
import { ReportDocument } from "@/lib/reports/document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/reports?period=month&month=2026-08 or ?period=year&year=2026
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Non autorizzato", { status: 401 });

  const period = parseReportPeriod(new URL(request.url).searchParams);
  if (!period) return new Response("Periodo non valido", { status: 400 });

  const data = await getReportData(session.user.id, period);
  const pdf = await renderToBuffer(<ReportDocument data={data} />);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
