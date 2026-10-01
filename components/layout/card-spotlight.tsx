"use client";

import { useEffect } from "react";

const CARD = ".bg-card.border, [data-slot='card']";

/**
 * One listener for the whole app: it tells the card under the pointer where the pointer is
 * (--spot-x / --spot-y), and the card's CSS draws a soft light there. Mouse and pen only.
 */
export function CardSpotlight() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let current: HTMLElement | null = null;
    let last: PointerEvent | null = null;
    let frame = 0;

    const clear = () => {
      current?.style.removeProperty("--spot-x");
      current?.style.removeProperty("--spot-y");
      current = null;
    };
    const update = () => {
      frame = 0;
      const target = last?.target instanceof Element ? last.target : null;
      const card = target?.closest<HTMLElement>(CARD) ?? null;
      if (card !== current) clear();
      if (!card || !last || !card.closest(".app-shell")) return;
      current = card;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--spot-x", `${last.clientX - rect.left}px`);
      card.style.setProperty("--spot-y", `${last.clientY - rect.top}px`);
    };
    const onMove = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(update);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", clear);
    return () => {
      cancelAnimationFrame(frame);
      clear();
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", clear);
    };
  }, []);

  return null;
}
