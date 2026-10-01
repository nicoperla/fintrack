import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getActiveSpace } from "@/lib/households";
import { getCoachData, getRecentMovements } from "@/lib/data/coach";
import { buildCoachContext, COACH_INSTRUCTIONS } from "@/lib/coach/context";
import { getCoachAccess } from "@/lib/coach/access";
import { CoachRateLimitError, streamCoachReply } from "@/lib/coach/providers";
import { formatRetryAfter, rateLimit, refundRateLimit, RULES } from "@/lib/rate-limit";
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

/** Error codes the chat understands; it falls back to the built-in answers for all of them. */
export type CoachErrorCode = "off" | "pro" | "verify" | "consent" | "quota" | "busy";

const fail = (status: number, code: CoachErrorCode, message: string) =>
  Response.json({ code, error: message }, { status });

/**
 * The free Groq tier allows about 8,000 tokens a minute for the whole app (two questions):
 * past that, answer with the built-in coach right away instead of queueing at Groq.
 * COACH_GLOBAL_PER_MINUTE overrides it (e.g. on a paid tier); with Anthropic there's no cap.
 */
function globalRule(providerId: string) {
  const configured = Number(process.env.COACH_GLOBAL_PER_MINUTE);
  if (configured > 0) return { limit: configured, windowSeconds: 60 };
  return providerId === "groq" ? { limit: 2, windowSeconds: 60 } : null;
}

/**
 * The AI coach: answers with the user's own numbers, streamed as plain text. Every refusal is a
 * JSON error with a code, and the page answers with the built-in coach instead.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non autorizzato" }, { status: 401 });

  const access = await getCoachAccess(session.user.id);
  if (access.status === "off") return fail(503, "off", "Coach AI non configurato");
  if (access.status === "pro") return fail(402, "pro", "Il coach AI fa parte di FinTrack Pro.");
  if (access.status === "verify") {
    return fail(403, "verify", "Conferma la tua email per usare il coach AI.");
  }
  if (access.status === "consent") {
    return fail(403, "consent", "Serve il tuo consenso per inviare i dati al coach AI.");
  }
  const { provider } = access;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Richiesta non valida" }, { status: 400 });

  const userId = session.user.id;
  const burstKey = `coach:burst:${userId}`;
  const dailyKey = `coach:daily:${userId}`;
  const burst = await rateLimit(burstKey, RULES.coachBurst);
  if (!burst.ok) {
    return fail(429, "quota", "Troppe domande di fila: aspetta un minuto e riprova.");
  }
  const daily = await rateLimit(dailyKey, RULES.coachDaily);
  if (!daily.ok) {
    await refundRateLimit(burstKey);
    return fail(
      429,
      "quota",
      `Hai usato le ${RULES.coachDaily.limit} domande al coach AI di oggi. Torna tra ${formatRetryAfter(daily.retryAfterSeconds)}.`,
    );
  }
  const refund = () => Promise.all([refundRateLimit(burstKey), refundRateLimit(dailyKey)]);

  const global = globalRule(provider.id);
  if (global) {
    const slot = await rateLimit(`coach:global:${provider.id}`, global);
    if (!slot.ok) {
      await refund();
      return fail(503, "busy", "Il coach AI è molto richiesto in questo momento.");
    }
  }

  const space = await getActiveSpace(session.user);
  const t = todayInAppTimeZone();
  const [data, movements] = await Promise.all([
    getCoachData(userId, space.id),
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

  const abort = new AbortController();
  const replies = streamCoachReply(provider, {
    instructions: COACH_INSTRUCTIONS,
    context,
    messages: body.data.messages,
    signal: abort.signal,
  });

  // Wait for the first piece of the answer: if the provider refuses, there's still time to
  // reply with an error code instead of a broken stream.
  let first: IteratorResult<string>;
  try {
    first = await replies.next();
  } catch (error) {
    await refund();
    if (error instanceof CoachRateLimitError) {
      return fail(503, "busy", "Il coach AI è molto richiesto in questo momento.");
    }
    console.error("Coach AI:", error);
    return fail(503, "busy", "Il coach AI non risponde in questo momento.");
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        for await (const text of replies) controller.enqueue(encoder.encode(text));
      } catch (error) {
        if (!abort.signal.aborted) {
          console.error("Coach AI:", error);
          controller.enqueue(encoder.encode("\n\nScusa, mi sono interrotto. Riprova tra poco."));
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
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Coach-Remaining": String(daily.remaining),
    },
  });
}
