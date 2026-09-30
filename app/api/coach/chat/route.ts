import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getActiveSpace } from "@/lib/households";
import { getCoachData, getRecentMovements } from "@/lib/data/coach";
import {
  aiCoachAvailable,
  buildCoachContext,
  COACH_INSTRUCTIONS,
  COACH_MODEL,
} from "@/lib/coach/context";
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
 * The AI coach: answers with the user's own numbers, streamed as plain text. Without an API key
 * it answers 503 and the page falls back to the built-in answers.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  if (!aiCoachAvailable()) {
    return Response.json({ error: "Coach AI non configurato" }, { status: 503 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Richiesta non valida" }, { status: 400 });

  const space = await getActiveSpace(session.user);
  const t = todayInAppTimeZone();
  const [data, movements] = await Promise.all([
    getCoachData(session.user.id, space.id),
    getRecentMovements(space.id),
  ]);
  const context = buildCoachContext(data, movements, {
    name: session.user.name,
    spaceName: space.name,
    today: toDateInputValue(utcDate(t.year, t.month, t.day)),
  });

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: COACH_MODEL,
    max_tokens: 1500,
    system: [
      { type: "text", text: COACH_INSTRUCTIONS },
      // The data changes with every movement; within a conversation it's reused from the cache.
      { type: "text", text: context, cache_control: { type: "ephemeral" } },
    ],
    messages: body.data.messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (error) {
        console.error("Coach AI:", error);
        controller.enqueue(
          encoder.encode("\n\nScusa, ho avuto un problema a rispondere. Riprova tra poco."),
        );
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
