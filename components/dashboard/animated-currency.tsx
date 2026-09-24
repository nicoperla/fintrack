"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function useCountUp(target: number, durationMs = 1100) {
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    // Hidden tabs pause requestAnimationFrame: show the final value instead of a frozen 0.
    const skip =
      document.visibilityState === "hidden" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (skip) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const next = from + (target - from) * easeOutCubic(progress);
      current.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

export function AnimatedCurrency({ value, className }: { value: number; className?: string }) {
  const animated = useCountUp(value);
  return (
    <span className={className}>
      <span aria-hidden>{formatCurrency(animated)}</span>
      <span className="sr-only">{formatCurrency(value)}</span>
    </span>
  );
}
