import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getActiveSpace } from "@/lib/households";
import { getCoachData, getRecentMovements } from "@/lib/data/coach";
import { buildCoachContext, COACH_INSTRUCTIONS } from "@/lib/coach/context";
import { coachProvider, CoachRateLimitError, streamCoachReply } from "@/lib/coach/providers";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20)
    .refine((m) => m[m.length - 1].role === "user", "L'ultimo messaggio deve essere dell'utente"),
});

/**
 * The AI coach: answers with the user's own numbers, streamed as plain text. Without an AI key
 * it answers 503 and the page falls back to the built-in answers.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  const provider = coachProvider();
  if (!provider) return Response.json({ error: "Coach AI non configurato" }, { status: 503 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Richiesta non valida" }, { status: 400 });

  const space = await getActiveSpace(session.user);
  const t = todayInAppTimeZone();
  const [data, movements] = await Promise.all([
    getCoachData(session.user.id, space.id),
    getRecentMovements(space.id, provider.movementDays, provider.movementLimit),
  ]);
  const context = buildCoachContext(
    data,
    movements,
    {
      name: session.user.name,
      spaceName: space.name,
      today: toDateInputValue(utcDate(t.year, t.month, t.day)),
    },
    body.data.messages[body.data.messages.length - 1].content,
  );

  const encoder = new TextEncoder();
  const abort = new AbortController();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of streamCoachReply(provider, {
          instructions: COACH_INSTRUCTIONS,
          context,
          messages: body.data.messages,
          signal: abort.signal,
        })) {
          controller.enqueue(encoder.encode(text));
        }
      } catch (error) {
        if (!abort.signal.aborted) {
          console.error("Coach AI:", error);
          controller.enqueue(
            encoder.encode(
              error instanceof CoachRateLimitError
                ? "Troppe domande in poco tempo: aspetta un minuto e riprova."
                : "\n\nScusa, ho avuto un problema a rispondere. Riprova tra poco.",
            ),
          );
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
