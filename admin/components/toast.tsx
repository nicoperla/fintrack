"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

type Toast = { id: number; text: string };

let listeners: ((toast: Toast) => void)[] = [];
let next = 1;

/** Shows a short confirmation in the corner. */
export function toast(text: string) {
  const item = { id: next++, text };
  for (const listener of listeners) listener(item);
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (item: Toast) => {
      setItems((current) => [...current, item]);
      setTimeout(() => setItems((current) => current.filter((t) => t.id !== item.id)), 4000);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 grid w-[min(22rem,calc(100vw-2rem))] gap-2"
    >
      {items.map((item) => (
        <p
          key={item.id}
          className="border-line bg-raised flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-xl"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
          {item.text}
        </p>
      ))}
    </div>
  );
}
