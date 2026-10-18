import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth/session";
import { getCoachAccess } from "@/lib/coach/access";
import { rateLimit, refundRateLimit, RULES } from "@/lib/rate-limit";
import {
  LETTER_INSTRUCTIONS,
  LETTER_MAX_BYTES,
  parseLetterReply,
  type LetterType,
} from "@/lib/tax/letter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (status: number, code: string, error: string) =>
  Response.json({ code, error }, { status });

/** What the file really is, from its first bytes (the browser's word isn't enough). */
function sniff(bytes: Uint8Array): LetterType | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    Buffer.from(bytes.subarray(8, 12)).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  if (starts(0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  return null;
}

/**
 * POST /api/730/lettera (multipart, field "file"): a letter explained by the AI. The file is read
 * in memory, sent to the provider and dropped: nothing is stored or logged.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail(401, "auth", "Non autorizzato");

  const access = await getCoachAccess(session.user.id);
  if (access.status === "off") return fail(503, "off", "La lettura delle lettere non è attiva.");
  if (access.status === "pro")
    return fail(402, "pro", "Spiegami questa lettera fa parte di Orbitly Pro.");
  if (access.status === "verify") return fail(403, "verify", "Conferma la tua email per usarla.");
  if (access.status === "consent") {
    return fail(403, "consent", "Serve il tuo consenso per inviare la foto all'AI.");
  }
  if (access.provider.id !== "anthropic") {
    return fail(503, "off", "La lettura delle lettere usa Claude, che qui non è configurato.");
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail(400, "file", "Manca la foto della lettera.");
  if (file.size > LETTER_MAX_BYTES) {
    return fail(413, "file", "Il file è troppo grande: al massimo 5 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) return fail(415, "file", "Serve una foto (JPG, PNG, WEBP) o un PDF.");

  const key = `letter:daily:${session.user.id}`;
  const quota = await rateLimit(key, RULES.letterDaily);
  if (!quota.ok) {
    return fail(429, "quota", "Hai letto molte lettere oggi: riprova domani.");
  }

  const data = Buffer.from(bytes).toString("base64");
  try {
    const message = await new Anthropic().messages.create(
      {
        model: access.provider.model,
        max_tokens: 1500,
        system: LETTER_INSTRUCTIONS,
        messages: [
          {
            role: "user",
            content: [
              type === "application/pdf"
                ? { type: "document", source: { type: "base64", media_type: type, data } }
                : { type: "image", source: { type: "base64", media_type: type, data } },
              { type: "text", text: "Spiegami questa lettera." },
            ],
          },
        ],
      },
      { signal: request.signal },
    );
    const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const explanation = parseLetterReply(text);
    if (!explanation) {
      await refundRateLimit(key);
      return fail(502, "busy", "Non sono riuscito a leggere la risposta. Riprova.");
    }
    return Response.json({ explanation }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await refundRateLimit(key);
    // Never the file or its text in the logs: only what went wrong.
    console.error("[lettera]", error instanceof Error ? error.name : "errore");
    return fail(502, "busy", "Il servizio di lettura non risponde. Riprova tra poco.");
  }
}
