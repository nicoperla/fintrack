import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coachProvider, CoachRateLimitError, streamCoachReply } from "./providers";

const sse = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });

const delta = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

const input = {
  instructions: "istruzioni",
  context: "dati",
  messages: [{ role: "user" as const, content: "Come sto andando?" }],
  signal: new AbortController().signal,
};

async function collect(gen: AsyncGenerator<string>) {
  let out = "";
  for await (const text of gen) out += text;
  return out;
}

describe("coachProvider", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("COACH_MODEL", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("is off without keys", () => {
    expect(coachProvider()).toBeNull();
  });

  it("uses the free Groq tier when it's the only key", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    expect(coachProvider()).toMatchObject({ id: "groq", model: "openai/gpt-oss-120b" });
  });

  it("prefers Anthropic when both are set", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(coachProvider()?.id).toBe("anthropic");
  });
});

describe("streamCoachReply with Groq", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("streams the text, even when events are split across chunks", async () => {
    const whole = delta("Ciao, ") + delta("stai andando **bene**.") + "data: [DONE]\n\n";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(sse([whole.slice(0, 25), whole.slice(25, 70), whole.slice(70)]), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const text = await collect(streamCoachReply(coachProvider()!, input));
    expect(text).toBe("Ciao, stai andando **bene**.");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
    expect(body.reasoning_effort).toBe("low");
    expect(body.messages[0]).toEqual({ role: "system", content: "istruzioni\n\ndati" });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer gsk_test");
  });

  it("reports the rate limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("slow down", { status: 429 })));
    await expect(collect(streamCoachReply(coachProvider()!, input))).rejects.toBeInstanceOf(
      CoachRateLimitError,
    );
  });
});
