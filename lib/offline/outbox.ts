/*
 * Movements recorded while offline wait here (in this browser only) and are sent when the
 * connection comes back. Entries remember who recorded them and in which space, so a different
 * account or space on the same device never receives them.
 */

export type OutboxEntry = {
  id: string;
  userId: string;
  spaceId: string;
  /** The saveTransaction input, as the form would send it. */
  input: Record<string, string>;
  /** For messages, e.g. "Pranzo · 12,50 €". */
  label: string;
  createdAt: number;
};

const KEY = "fintrack.outbox";
export const OUTBOX_EVENT = "fintrack:outbox";

function read(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: OutboxEntry[]) {
  try {
    if (entries.length) localStorage.setItem(KEY, JSON.stringify(entries));
    else localStorage.removeItem(KEY);
  } finally {
    window.dispatchEvent(new Event(OUTBOX_EVENT));
  }
}

export function queueEntry(entry: Omit<OutboxEntry, "id" | "createdAt">) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  write([...read(), { ...entry, id, createdAt: Date.now() }]);
}

export function pendingEntries(userId: string, spaceId: string) {
  return read().filter((e) => e.userId === userId && e.spaceId === spaceId);
}

export type FlushResult = { synced: number; rejected: OutboxEntry[]; remaining: number };

/**
 * Sends the entries of this user and space in order. An entry the server rejects (e.g. its
 * account was deleted meanwhile) is dropped and reported; a network error stops the flush and
 * keeps what's left for next time.
 */
export async function flushOutbox(
  userId: string,
  spaceId: string,
  send: (input: Record<string, string>) => Promise<{ ok: boolean }>,
): Promise<FlushResult> {
  let synced = 0;
  const rejected: OutboxEntry[] = [];
  for (const entry of pendingEntries(userId, spaceId)) {
    let ok: boolean;
    try {
      ok = (await send(entry.input)).ok;
    } catch {
      break;
    }
    if (ok) synced++;
    else rejected.push(entry);
    write(read().filter((e) => e.id !== entry.id));
  }
  return { synced, rejected, remaining: pendingEntries(userId, spaceId).length };
}
