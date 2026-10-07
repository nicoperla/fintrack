import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/auth/session";
import { getActiveSpace } from "@/lib/households";
import { prisma } from "@/lib/db/prisma";
import { hasPro } from "@/lib/billing/plan";
import { getFamilyFileInput } from "@/lib/data/family-file";
import { buildFamilyFile } from "@/lib/family-file";
import { FamilyFilePdf } from "@/lib/family-file-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/fascicolo/pdf?importi=1: the family file of the active space (FinTrack Pro).
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Non autorizzato", { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { plan: true },
  });
  if (!hasPro(user)) {
    return new Response("Il fascicolo in PDF fa parte di FinTrack Pro.", { status: 402 });
  }
  const space = await getActiveSpace(session.user);
  const showAmounts = new URL(request.url).searchParams.get("importi") === "1";
  const content = buildFamilyFile(await getFamilyFileInput(space.id), { showAmounts });
  const pdf = await renderToBuffer(<FamilyFilePdf content={content} />);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fintrack-fascicolo-di-famiglia${showAmounts ? "-con-importi" : ""}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
