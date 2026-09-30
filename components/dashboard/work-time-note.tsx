"use client";

import { Hourglass } from "lucide-react";
import { useWorkTime } from "@/components/currency-provider";

/** "Sono 62 ore del tuo lavoro": shown only when the working-time rate is known. */
export function WorkTimeNote({ amount }: { amount: number }) {
  const workTime = useWorkTime()(amount);
  if (!workTime) return null;
  return (
    <p className="text-muted-foreground flex items-center gap-1 text-xs">
      <Hourglass className="size-3.5 shrink-0" aria-hidden />
      Equivale a {workTime} del tuo lavoro
    </p>
  );
}
