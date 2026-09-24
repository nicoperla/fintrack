"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Tone = "ok" | "warning" | "over";

const TONE_VARS: Record<Tone, { fill: string; track: string }> = {
  ok: { fill: "var(--meter-ok)", track: "var(--meter-ok-track)" },
  warning: { fill: "var(--meter-warn)", track: "var(--meter-warn-track)" },
  over: { fill: "var(--meter-over)", track: "var(--meter-over-track)" },
};

/** A horizontal meter that grows from 0 on mount. Pass `color` to tint it with an identity color. */
export function Meter({
  value,
  tone = "ok",
  color,
  label,
  className,
}: {
  value: number;
  tone?: Tone;
  color?: string | null;
  label: string;
  className?: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const fill = color ?? TONE_VARS[tone].fill;
  const track = color ? `color-mix(in oklch, ${color} 18%, transparent)` : TONE_VARS[tone].track;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className={cn("h-2 w-full overflow-hidden rounded-full", className)}
      style={{ backgroundColor: track }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
        style={{ width: `${clamp(shown) * 100}%`, backgroundColor: fill }}
      />
    </div>
  );
}
