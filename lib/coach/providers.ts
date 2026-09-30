import Anthropic from "@anthropic-ai/sdk";

/*
 * Who answers in "Chiedi al coach": Claude (Anthropic, paid) or a free Groq model. Whichever
 * key is set on the server wins, Anthropic first; with neither, the page uses its built-in
 * answers.
 */

export type CoachProvider = {
  id: "anthropic" | "groq";
  label: string;
  model: string;
  /** How many recent movements go in the context: free tiers have small token budgets. */
  movementLimit: number;
  movementDays: number;
  maxTokens: number;
};

export function coachProvider(): CoachProvider | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      id: "anthropic",
      label: "Claude",
      model: process.env.COACH_MODEL || "claude-opus-5-5",
      movementLimit: 300,
      movementDays: 90,
      maxTokens: 1500,
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      id: "groq",
      label: "Groq",
      model: process.env.COACH_MODEL || "llama-3.3-70b-versatile",
      // The free tier allows about 12,000 tokens a minute: keep each request well below.
      movementLimit: 80,
      movementDays: 45,
      maxTokens: 900,
    };
  }
  return null;
}

/** The provider refused because of its rate limit: the user just has to wait a moment. */
export class CoachRateLimitError extends Error {}

type Turn = { role: "user" | "assistant"; content: string };

export async function* streamCoachReply(
  provider: CoachProvider,
  input: { instructions: string; context: string; messages: Turn[]; signal: AbortSignal },
): AsyncGenerator<string> {
  if (provider.id === "anthropic") {
    const stream = new Anthropic().messages.stream(
      {
        model: provider.model,
        max_tokens: provider.maxTokens,
        system: [
          { type: "text", text: input.instructions },
          // The data changes with every movement; within a conversation it's reused from the cache.
          { type: "text", text: input.context, cache_control: { type: "ephemeral" } },
        ],
        messages: input.messages,
      },
      { signal: input.signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
    return;
  }

  // Groq speaks the OpenAI chat completions format, streamed as server-sent events.
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: provider.maxTokens,
      temperature: 0.4,
      stream: true,
      messages: [
        { role: "system", content: `${input.instructions}\n\n${input.context}` },
        ...input.messages,
      ],
    }),
    signal: input.signal,
  });
  if (response.status === 429) throw new CoachRateLimitError();
  if (!response.ok || !response.body) {
    throw new Error(`Groq ${response.status}: ${await response.text().catch(() => "")}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.trim();
      if (!data.startsWith("data:")) continue;
      const payload = data.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const text = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (text) yield text as string;
      } catch {
        // A keep-alive or a partial line: ignore it.
      }
    }
  }
}
