import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { saveTransactionInSpace } from "@/lib/transactions/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  spaceId: z.string().min(1).max(40),
  input: z.record(z.string(), z.string()),
});

/**
 * Where the offline outbox sends the movements recorded without connection. A plain endpoint
 * rather than a server action: it works regardless of the client router's state after being
 * offline. The movement goes to the space it was recorded in, if the user still belongs to it.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "Non autorizzato" }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json({ ok: false, error: "Richiesta non valida" }, { status: 400 });

  const membership = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId: body.data.spaceId, userId: session.user.id } },
    select: { household: { select: { id: true, currency: true } } },
  });
  if (!membership) {
    return Response.json(
      { ok: false, error: "Non fai più parte di questo spazio." },
      { status: 403 },
    );
  }

  const result = await saveTransactionInSpace(
    { ...membership.household, userId: session.user.id },
    null,
    body.data.input,
  );
  if (result.ok) revalidatePath("/", "layout");
  return Response.json(result, { status: result.ok ? 201 : 422 });
}
