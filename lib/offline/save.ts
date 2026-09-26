import { saveTransaction } from "@/app/(dashboard)/transactions/actions";
import type { ActionResult } from "@/lib/action-result";
import { queueEntry } from "@/lib/offline/outbox";

type Ids = { userId: string; spaceId: string };

/**
 * Saves a new movement, or keeps it in the outbox when there's no connection: offline, the
 * app stays usable for recording and syncs later (OfflineSync replays the queue).
 */
export async function saveOrQueue(
  input: Record<string, string>,
  ids: Ids,
  label: string,
): Promise<ActionResult & { queued?: boolean }> {
  const queue = () => {
    queueEntry({ ...ids, input, label });
    return { ok: true, queued: true };
  };
  if (!navigator.onLine) return queue();
  try {
    return await saveTransaction(null, input);
  } catch (error) {
    // A server action that can't reach the server rejects with a TypeError ("Failed to fetch").
    if (!navigator.onLine || error instanceof TypeError) return queue();
    throw error;
  }
}
