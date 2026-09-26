import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushOutbox, pendingEntries, queueEntry } from "./outbox";

// Minimal browser globals for the outbox (it only needs localStorage and events).
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
});
vi.stubGlobal("window", { dispatchEvent: () => true });
vi.stubGlobal("Event", class {});

const entry = (label: string, spaceId = "s1", userId = "u1") => ({
  userId,
  spaceId,
  label,
  input: { amount: "10", description: label },
});

describe("outbox", () => {
  beforeEach(() => store.clear());

  it("keeps entries per user and space", () => {
    queueEntry(entry("a"));
    queueEntry(entry("b", "s2"));
    queueEntry(entry("c", "s1", "u2"));
    expect(pendingEntries("u1", "s1").map((e) => e.label)).toEqual(["a"]);
  });

  it("sends entries in order and empties the queue", async () => {
    queueEntry(entry("a"));
    queueEntry(entry("b"));
    const sent: string[] = [];
    const result = await flushOutbox("u1", "s1", async (input) => {
      sent.push(input.description);
      return { ok: true };
    });
    expect(sent).toEqual(["a", "b"]);
    expect(result).toMatchObject({ synced: 2, rejected: [], remaining: 0 });
  });

  it("drops and reports entries the server rejects", async () => {
    queueEntry(entry("bad"));
    queueEntry(entry("good"));
    const result = await flushOutbox("u1", "s1", async (input) => ({
      ok: input.description === "good",
    }));
    expect(result.synced).toBe(1);
    expect(result.rejected.map((e) => e.label)).toEqual(["bad"]);
    expect(result.remaining).toBe(0);
  });

  it("stops on network errors and keeps the rest", async () => {
    queueEntry(entry("a"));
    queueEntry(entry("b"));
    const result = await flushOutbox("u1", "s1", async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(result).toMatchObject({ synced: 0, remaining: 2 });
  });

  it("leaves other spaces untouched", async () => {
    queueEntry(entry("mine"));
    queueEntry(entry("other", "s2"));
    await flushOutbox("u1", "s1", async () => ({ ok: true }));
    expect(pendingEntries("u1", "s2").map((e) => e.label)).toEqual(["other"]);
  });
});
