"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CloudOff, RefreshCw } from "lucide-react";
import { useSpaceInfo } from "@/components/currency-provider";
import { flushOutbox, OUTBOX_EVENT, pendingEntries } from "@/lib/offline/outbox";

/**
 * Replays one queued movement through the API (not a server action: after a stretch offline the
 * client router may still be settling, and actions wait for it). Throws to keep the entry for
 * later on network or server errors; resolves { ok: false } when the server rejects it.
 */
async function sendQueued(spaceId: string, input: Record<string, string>) {
  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spaceId, input }),
    // Signed out meanwhile: the middleware would redirect to the login page, which isn't a save.
    redirect: "manual",
  });
  if (res.type === "opaqueredirect" || res.status === 401 || res.status >= 500) {
    throw new Error(`sync ${res.status}`);
  }
  return { ok: res.ok };
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * Registers the service worker, tells the user when they're looking at saved data, and replays
 * the movements recorded offline as soon as the connection is back.
 */
export function OfflineSync() {
  const router = useRouter();
  const { userId, spaceId } = useSpaceInfo();
  const online = useOnline();
  const [pending, setPending] = useState(0);
  const syncing = useRef(false);

  useEffect(() => {
    // In development the cache would serve stale code between edits.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("[pwa] registrazione del service worker fallita", error);
    });
  }, []);

  useEffect(() => {
    const update = () => setPending(pendingEntries(userId, spaceId).length);
    update();
    window.addEventListener(OUTBOX_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(OUTBOX_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [userId, spaceId]);

  const sync = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    if (pendingEntries(userId, spaceId).length === 0) return;
    syncing.current = true;
    try {
      const result = await flushOutbox(userId, spaceId, (input) => sendQueued(spaceId, input));
      if (result.synced > 0) {
        toast.success(
          result.synced === 1
            ? "Sincronizzato il movimento registrato offline"
            : `Sincronizzati ${result.synced} movimenti registrati offline`,
        );
      }
      for (const entry of result.rejected) {
        toast.error(`Non sono riuscito a salvare «${entry.label}»: registralo di nuovo.`, {
          duration: 10000,
        });
      }
      if (result.synced > 0) router.refresh();
    } finally {
      syncing.current = false;
    }
  }, [router, userId, spaceId]);

  // Back online: send the queue and reload the data shown from the cache.
  useEffect(() => {
    if (!online) return;
    sync();
    const onOnline = () => router.refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [online, sync, router]);

  if (online && pending === 0) return null;

  return (
    <div
      role="status"
      className="bg-muted text-muted-foreground flex items-center justify-center gap-2 border-b px-4 py-1.5 text-center text-xs"
    >
      {online ? (
        <>
          <RefreshCw className="size-3.5 motion-safe:animate-spin" aria-hidden />
          Sincronizzazione di {pending} {pending === 1 ? "movimento" : "movimenti"}…
        </>
      ) : (
        <>
          <CloudOff className="size-3.5 shrink-0" aria-hidden />
          <span>
            Sei offline: vedi i dati dell&apos;ultima visita.
            {pending > 0
              ? ` ${pending} ${pending === 1 ? "movimento" : "movimenti"} in attesa di sincronizzazione.`
              : " Puoi comunque registrare movimenti: li sincronizzo al ritorno della connessione."}
          </span>
        </>
      )}
    </div>
  );
}
