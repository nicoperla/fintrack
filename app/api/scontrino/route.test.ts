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
  RULES: { receiptDaily: { limit: 30, windowSeconds: 86400 } },
}));

const JPEG: Uint8Array<ArrayBuffer> = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PDF = new Uint8Array(new TextEncoder().encode("%PDF-1.4"));

function post(bytes: Uint8Array<ArrayBuffer>) {
  const body = new FormData();
  body.append("file", new File([bytes], "scontrino.jpg", { type: "image/jpeg" }));
  return POST(new Request("http://localhost/api/scontrino", { method: "POST", body }));
}

beforeEach(() => {
  vi.clearAllMocks();
  access.mockResolvedValue({
    status: "ready",
    provider: { id: "anthropic", model: "claude-test" },
  });
  rateLimit.mockResolvedValue({ ok: true });
});

describe("POST /api/scontrino", () => {
  it("reads a receipt from a photo", async () => {
    create.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"readable":true,"merchant":"Farmacia","fiscalCode":true,"items":[{"description":"Tachipirina","amount":5.9,"kind":"farmaco","aic":"012745093"}]}',
        },
      ],
    });
    const res = await post(JPEG);
    expect(res.status).toBe(200);
    expect((await res.json()).receipt.items[0]).toMatchObject({ kind: "farmaco", amount: 5.9 });
    expect(create.mock.calls[0][0].messages[0].content[0]).toMatchObject({
      type: "image",
      source: { media_type: "image/jpeg" },
    });
  });

  it("takes only photos, after consent", async () => {
    expect((await post(PDF)).status).toBe(415);
    access.mockResolvedValue({ status: "consent", provider: { id: "anthropic", model: "x" } });
    expect((await post(JPEG)).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("gives the reading back to the quota when the AI fails", async () => {
    create.mockRejectedValue(new Error("overloaded"));
    expect((await post(JPEG)).status).toBe(502);
    expect(refundRateLimit).toHaveBeenCalledWith("receipt:daily:user-1");
  });
});
