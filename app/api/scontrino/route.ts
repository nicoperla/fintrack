import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth/session";
import { getCoachAccess } from "@/lib/coach/access";
import { rateLimit, refundRateLimit, RULES } from "@/lib/rate-limit";
import {
  RECEIPT_INSTRUCTIONS,
  RECEIPT_MAX_BYTES,
  RECEIPT_TYPES,
  parseReceiptReply,
  type ReceiptType,
} from "@/lib/receipts/receipt";
import { sniffType } from "@/lib/uploads/sniff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (status: number, code: string, error: string) =>
  Response.json({ code, error }, { status });

/**
 * POST /api/scontrino (multipart, field "file"): a receipt read by the AI, item by item. The
 * picture is read in memory, sent to the provider and dropped: nothing is stored or logged.
 * Saving the movements is a separate step the user confirms.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail(401, "auth", "Non autorizzato");

  const access = await getCoachAccess(session.user.id);
  if (access.status === "off") return fail(503, "off", "La lettura degli scontrini non è attiva.");
  if (access.status === "pro") {
    return fail(402, "pro", "La foto dello scontrino fa parte di Orbitly Pro.");
  }
  if (access.status === "verify") return fail(403, "verify", "Conferma la tua email per usarla.");
  if (access.status === "consent") {
    return fail(403, "consent", "Serve il tuo consenso per inviare la foto all'AI.");
  }
  if (access.provider.id !== "anthropic") {
    return fail(503, "off", "La lettura degli scontrini usa Claude, che qui non è configurato.");
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail(400, "file", "Manca la foto dello scontrino.");
  if (file.size > RECEIPT_MAX_BYTES) {
    return fail(413, "file", "La foto è troppo grande: al massimo 5 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffType(bytes);
  if (!sniffed || !RECEIPT_TYPES.includes(sniffed as ReceiptType)) {
    return fail(415, "file", "Serve una foto (JPG, PNG o WEBP).");
  }
  const type = sniffed as ReceiptType;

  const key = `receipt:daily:${session.user.id}`;
  const quota = await rateLimit(key, RULES.receiptDaily);
  if (!quota.ok) return fail(429, "quota", "Hai letto molti scontrini oggi: riprova domani.");

  try {
    const message = await new Anthropic().messages.create(
      {
        model: access.provider.model,
        max_tokens: 2500,
        system: RECEIPT_INSTRUCTIONS,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: type,
                  data: Buffer.from(bytes).toString("base64"),
                },
              },
              { type: "text", text: "Leggi questo scontrino." },
            ],
          },
        ],
      },
      { signal: request.signal },
    );
    const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const receipt = parseReceiptReply(text);
    if (!receipt) {
      await refundRateLimit(key);
      return fail(502, "busy", "Non sono riuscito a leggere la risposta. Riprova.");
    }
    return Response.json({ receipt }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await refundRateLimit(key);
    // Never the picture or what's on it in the logs: only what went wrong.
    console.error("[scontrino]", error instanceof Error ? error.name : "errore");
    return fail(502, "busy", "Il servizio di lettura non risponde. Riprova tra poco.");
  }
}
