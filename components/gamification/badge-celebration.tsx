"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "fintrack.badges.seen";

/**
 * Toasts badges unlocked since this browser last saw them. The first visit only records the current
 * state, so an existing user isn't greeted by a burst of old achievements.
 */
export function BadgeCelebration({ unlocked }: { unlocked: { id: string; name: string }[] }) {
  useEffect(() => {
    let seen: string[] | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      seen = raw ? JSON.parse(raw) : null;
    } catch {
      return;
    }
    if (seen) {
      const fresh = unlocked.filter((b) => !seen!.includes(b.id));
      fresh.forEach((b, i) =>
        setTimeout(
          () =>
            toast.success(`Nuovo traguardo: ${b.name}`, {
              description: "Lo trovi nella pagina Traguardi.",
              duration: 6000,
            }),
          600 + i * 400,
        ),
      );
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked.map((b) => b.id)));
    } catch {
      // Convenience only.
    }
  }, [unlocked]);

  return null;
}
