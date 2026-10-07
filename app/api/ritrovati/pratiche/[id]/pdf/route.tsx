import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/auth/session";
import { getActiveSpace } from "@/lib/households";
import { prisma } from "@/lib/db/prisma";
import { hasPro } from "@/lib/billing/plan";
import { LetterDocument } from "@/lib/claims/letter-pdf";
import { NAME_PLACEHOLDER } from "@/lib/claims/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ritrovati/pratiche/<id>/pdf: a claim's letter, ready to print (FinTrack Pro).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new Response("Non autorizzato", { status: 401 });

  const space = await getActiveSpace(session.user);
  const [user, claim] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { plan: true } }),
    prisma.claim.findFirst({
      where: { id: params.id, householdId: space.id },
      select: { subject: true, body: true, user: { select: { name: true } } },
    }),
  ]);
  if (!claim) return new Response("Pratica non trovata", { status: 404 });
  if (!hasPro(user)) {
    return new Response("Le lettere in PDF fanno parte di FinTrack Pro.", { status: 402 });
  }

  const pdf = await renderToBuffer(
    <LetterDocument
      data={{
        subject: claim.subject,
        body: claim.body,
        // The letter is in the name of whoever opened the claim.
        sender: claim.user?.name || NAME_PLACEHOLDER,
      }}
    />,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fintrack-lettera-${params.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
