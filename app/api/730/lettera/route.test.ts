import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { create, access, rateLimit, refundRateLimit } = vi.hoisted(() => ({
  create: vi.fn(),
  access: vi.fn(),
  rateLimit: vi.fn(),
  refundRateLimit: vi.fn(),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/lib/coach/access", () => ({ getCoachAccess: access }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit,
  refundRateLimit,
  RULES: { letterDaily: { limit: 10, windowSeconds: 86400 } },
}));

const PNG: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const PDF = new Uint8Array(new TextEncoder().encode("%PDF-1.4 lettera"));
const ready = { status: "ready", provider: { id: "anthropic", model: "claude-test" } };

function post(bytes: Uint8Array<ArrayBuffer> | null, type = "image/png") {
  const body = new FormData();
  if (bytes) body.append("file", new File([bytes], "lettera", { type }));
  return POST(new Request("http://localhost/api/730/lettera", { method: "POST", body }));
}

beforeEach(() => {
  vi.clearAllMocks();
  access.mockResolvedValue(ready);
  rateLimit.mockResolvedValue({ ok: true });
});

describe("POST /api/730/lettera", () => {
  it("explains a letter and sends the picture as an image", async () => {
    create.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"readable":true,"sender":"INPS","kind":"Richiesta di documenti","summary":"Ti chiede un documento.","steps":["Rispondi"],"urgency":"media"}',
        },
      ],
    });
    const res = await post(PNG);
    expect(res.status).toBe(200);
    expect((await res.json()).explanation).toMatchObject({ sender: "INPS", urgency: "media" });
    const sent = create.mock.calls[0][0];
    expect(sent.model).toBe("claude-test");
    expect(sent.messages[0].content[0]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/png" },
    });
  });

  it("sends a PDF as a document, whatever the browser says it is", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: '{"readable":false}' }] });
    await post(PDF, "image/png");
    expect(create.mock.calls[0][0].messages[0].content[0]).toMatchObject({
      type: "document",
      source: { media_type: "application/pdf" },
    });
  });

  it("refuses files that aren't pictures or PDFs, and empty requests", async () => {
    expect(
      (await post(new Uint8Array(new TextEncoder().encode("<html>")), "image/png")).status,
    ).toBe(415);
    expect((await post(null)).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("asks for consent, Pro or Claude before reading anything", async () => {
    access.mockResolvedValue({ status: "consent", provider: ready.provider });
    expect((await post(PNG)).status).toBe(403);
    access.mockResolvedValue({ status: "pro", provider: ready.provider });
    expect((await post(PNG)).status).toBe(402);
    access.mockResolvedValue({ status: "ready", provider: { id: "groq", model: "x" } });
    expect((await post(PNG)).status).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });

  it("stops at the daily limit", async () => {
    rateLimit.mockResolvedValue({ ok: false });
    expect((await post(PNG)).status).toBe(429);
    expect(create).not.toHaveBeenCalled();
  });

  it("gives the reading back to the quota when the AI fails or answers nonsense", async () => {
    create.mockRejectedValue(new Error("overloaded"));
    expect((await post(PNG)).status).toBe(502);
    create.mockResolvedValue({ content: [{ type: "text", text: "Non posso" }] });
    expect((await post(PNG)).status).toBe(502);
    expect(refundRateLimit).toHaveBeenCalledTimes(2);
  });
});
