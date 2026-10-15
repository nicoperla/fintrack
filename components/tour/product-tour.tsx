"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FEATURE_MAP,
  TOUR_CHAPTERS,
  TOUR_STEPS,
  type TourStep,
} from "@/components/tour/tour-steps";
import { cn } from "@/lib/utils";
import { MARGIN, placeCard, type Box } from "@/components/tour/placement";

/*
 * The guided tour: the screen goes dark, a frame of light glides to one element at a time and
 * a card next to it says what it does. It starts by itself the first time the dashboard opens
 * (after the first-run setup), once per browser; the "?" in the header (TourButton) replays it.
 */

const STORAGE_KEY = "orbitly.tour";
const START_EVENT = "orbitly:tour";
/** Space between the element and the frame of light. */
const PAD = 8;
const QUICK_ENTRY_INPUT = "quick-entry-input";

/** Replays the tour from the start, from any page. */
export function startTour() {
  window.dispatchEvent(new Event(START_EVENT));
}

// The tour is a convenience: when storage is blocked it never starts by itself.
function alreadySeen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "done";
  } catch {
    return true;
  }
}
function rememberSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "done");
  } catch {
    // Nothing to do: it may show again next time.
  }
}

const isShown = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
};

/** The first of the step's targets that is on screen (desktop menu or phone bar). */
function findTarget(names: string[]) {
  for (let i = 0; i < names.length; i++) {
    const el = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${names[i]}"]`)).find(
      isShown,
    );
    if (el) return { el, fallback: i > 0 };
  }
  return null;
}

/** In the sticky header or the fixed bottom bar: always on screen, nothing to scroll. */
function isPinned(el: HTMLElement) {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const position = getComputedStyle(node).position;
    if (position === "fixed" || position === "sticky") return true;
  }
  return false;
}

/** Another window (a form, a menu) opened on top of the page: the tour waits for it. */
const otherDialogOpen = () =>
  Boolean(document.querySelector('[role="dialog"]:not([data-tour-card]), [role="alertdialog"]'));

export function ProductTour() {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [fallback, setFallback] = useState(false);
  const [paused, setPaused] = useState(false);
  const [screen, setScreen] = useState({ width: 0, height: 0 });
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const [mounted, setMounted] = useState(false);
  const target = useRef<HTMLElement | null>(null);
  const direction = useRef<1 | -1>(1);
  const cardRef = useRef<HTMLDivElement>(null);

  const step: TourStep | null = index === null ? null : TOUR_STEPS[index];
  const open = index !== null && !paused;
  const total = TOUR_STEPS.length;

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    rememberSeen();
    target.current = null;
    setBox(null);
    setIndex(null);
  }, []);

  const move = useCallback((delta: 1 | -1) => {
    direction.current = delta;
    setIndex((i) => {
      if (i === null) return i;
      const to = i + delta;
      if (to < 0) return i;
      if (to >= TOUR_STEPS.length) {
        rememberSeen();
        return null;
      }
      return to;
    });
  }, []);

  const begin = useCallback(() => {
    direction.current = 1;
    setIndex(0);
  }, []);

  // The "?" button: from another page, go to the dashboard first.
  useEffect(() => {
    const onStart = () => {
      if (window.location.pathname === "/dashboard") begin();
      else router.push("/dashboard?guida=1");
    };
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, [begin, router]);

  // First visit of the dashboard, or ?guida=1: wait for the page to be ready and nothing else
  // open on top of it. During the first-run setup there is no dashboard yet: the tour keeps
  // waiting, and starts as soon as the setup hands over to the dashboard.
  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const asked = new URLSearchParams(window.location.search).has("guida");
    if (!asked && alreadySeen()) return;
    const timer = window.setInterval(() => {
      // Already running (started from the "?" meanwhile): don't send it back to the start.
      if (document.querySelector("[data-tour-card]")) {
        window.clearInterval(timer);
      } else if (document.querySelector('[data-tour="hero"]') && !otherDialogOpen()) {
        window.clearInterval(timer);
        // Only now: if the effect runs again before starting, it must still see ?guida=1.
        if (asked) window.history.replaceState(null, "", "/dashboard");
        begin();
      }
    }, 600);
    return () => window.clearInterval(timer);
  }, [pathname, begin]);

  // Leaving the dashboard ends the tour.
  useEffect(() => {
    if (pathname === "/dashboard") return;
    setIndex((i) => {
      if (i !== null) rememberSeen();
      return null;
    });
  }, [pathname]);

  const measure = useCallback(() => {
    setScreen({ width: window.innerWidth, height: window.innerHeight });
    const el = target.current;
    if (!el || !el.isConnected) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  // Find the step's element, bring it into view, then follow it while the page moves.
  useEffect(() => {
    if (!step) return;
    target.current = null;
    setBox(null);
    setFallback(false);
    measure();
    if (!step.targets) return;
    let cancelled = false;
    let tries = 0;
    const look = () => {
      if (cancelled) return;
      const found = findTarget(step.targets!);
      if (found) {
        target.current = found.el;
        setFallback(found.fallback);
        const r = found.el.getBoundingClientRect();
        if (!isPinned(found.el) && (r.top < 72 || r.bottom > window.innerHeight - 96)) {
          found.el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
        }
        measure();
      } else if (++tries < 10) {
        window.setTimeout(look, 120);
      } else if (step.optional) {
        move(direction.current);
      }
    };
    look();
    return () => {
      cancelled = true;
    };
  }, [step, measure, move, reduceMotion]);

  useEffect(() => {
    if (index === null) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    // Forms and menus opened from the lit element (e.g. the quick entry) go above the tour.
    const watch = window.setInterval(() => setPaused(otherDialogOpen()), 400);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
      observer.disconnect();
      window.clearInterval(watch);
    };
  }, [index, measure]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new ResizeObserver(() =>
      setCardSize({ width: card.offsetWidth, height: card.offsetHeight }),
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [open]);

  // The new card content arrives after the old one fades out: focus its main button then.
  useEffect(() => {
    if (index === null) return;
    const timer = window.setTimeout(
      () =>
        cardRef.current
          ?.querySelector<HTMLButtonElement>("[data-tour-next]")
          ?.focus({ preventScroll: true }),
      reduceMotion ? 0 : 220,
    );
    return () => window.clearTimeout(timer);
  }, [index, reduceMotion]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      const el = event.target instanceof HTMLElement ? event.target : null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "ArrowRight" || (event.key === "Enter" && !el?.closest("button, a"))) {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, close, move]);

  if (!mounted || !step || index === null || paused) return null;

  const hole = box
    ? {
        top: box.top - PAD,
        left: box.left - PAD,
        width: box.width + PAD * 2,
        height: box.height + PAD * 2,
      }
    : null;
  const wide = step.kind === "map";
  const cardWidth = Math.min(wide ? 760 : 392, screen.width - MARGIN * 2);
  const spot = placeCard(hole, { width: cardWidth, height: cardSize.height }, screen);
  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 32 };
  const last = index === total - 1;

  function openFeature(href: string) {
    close();
    router.push(href);
  }

  function startRecording() {
    close();
    const input = document.getElementById(QUICK_ENTRY_INPUT);
    input?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    input?.focus({ preventScroll: true });
  }

  // Clicks outside the lit element do nothing; inside it they work only on interactive steps.
  const blockers =
    hole && step.interactive
      ? [
          { top: 0, left: 0, width: "100%", height: Math.max(0, hole.top) },
          { top: hole.top + hole.height, left: 0, width: "100%", bottom: 0 },
          { top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height },
          { top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height },
        ]
      : [{ top: 0, left: 0, right: 0, bottom: 0 }];

  return createPortal(
    <>
      {blockers.map((style, i) => (
        <div key={i} aria-hidden className="fixed z-[70]" style={style} />
      ))}

      <motion.div
        aria-hidden
        className="pointer-events-none fixed z-[71] rounded-2xl"
        initial={false}
        animate={
          hole
            ? { top: hole.top, left: hole.left, width: hole.width, height: hole.height }
            : { top: screen.height / 2, left: screen.width / 2, width: 0, height: 0 }
        }
        transition={spring}
        style={{ boxShadow: "0 0 0 200vmax rgba(4, 4, 14, 0.74)" }}
      >
        {hole && (
          <span className="tour-ring absolute inset-0 rounded-2xl shadow-[0_0_0_2px_rgba(167,139,250,0.95),0_0_36px_6px_rgba(139,92,246,0.5)]" />
        )}
      </motion.div>

      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        data-tour-card
        className="bg-card/95 text-card-foreground fixed z-[72] rounded-2xl border shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        style={{ width: cardWidth, opacity: cardSize.height ? 1 : 0 }}
        initial={false}
        animate={{ top: spot.top, left: spot.left }}
        transition={spring}
      >
        {spot.arrow && (
          <span
            aria-hidden
            className={cn(
              "bg-card absolute size-3 rotate-45 border",
              spot.arrow.side === "below"
                ? "-top-[7px] border-r-0 border-b-0"
                : "-bottom-[7px] border-t-0 border-l-0",
            )}
            style={{ left: spot.arrow.x - 6 }}
          />
        )}
        <div className="bg-muted/70 relative h-1 overflow-hidden rounded-t-2xl">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
            initial={false}
            animate={{ width: `${((index + 1) / total) * 100}%` }}
            transition={spring}
          />
        </div>

        <div className="max-h-[calc(100svh-2rem)] overflow-x-hidden overflow-y-auto">
          {/* A CSS animation, restarted by the key: it always reaches the end, even when the
              steps change faster than it runs. */}
          <div
            key={step.id}
            className="tour-step grid gap-3 p-5"
            style={{ "--tour-from": `${direction.current * 16}px` } as CSSProperties}
          >
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                <span className="font-medium text-violet-600 dark:text-violet-300">
                  {step.chapter}
                </span>{" "}
                · {index + 1} di {total}
              </span>
              <button
                type="button"
                onClick={close}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -m-1 flex items-center gap-1 rounded-md p-1 outline-none focus-visible:ring-3"
              >
                Esci <X className="size-3.5" aria-hidden />
              </button>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.9)]">
                <step.icon className="size-5" aria-hidden />
              </span>
              <h2
                id="tour-title"
                className="font-display pt-1.5 text-lg leading-snug font-semibold tracking-tight text-balance"
              >
                {step.title}
              </h2>
            </div>

            <div
              id="tour-body"
              className="text-muted-foreground grid gap-2 text-sm leading-relaxed"
            >
              {step.body.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {fallback && step.fallbackNote && (
                <p className="text-foreground font-medium">{step.fallbackNote}</p>
              )}
            </div>

            {step.tips && (
              <ul className="grid gap-1.5 text-sm">
                {step.tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-400"
                    />
                    {tip}
                  </li>
                ))}
              </ul>
            )}

            {step.interactive && hole && (
              <p className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-700 dark:text-violet-200">
                Prova adesso: la casella illuminata funziona davvero.
              </p>
            )}

            {step.kind === "welcome" && (
              <ol className="flex flex-wrap gap-1.5" aria-label="I capitoli della guida">
                {TOUR_CHAPTERS.map((chapter, i) => (
                  <li
                    key={chapter}
                    className="bg-muted/60 rounded-full border px-2.5 py-1 text-xs font-medium"
                  >
                    <span className="text-muted-foreground">{i + 1}.</span> {chapter}
                  </li>
                ))}
              </ol>
            )}

            {step.kind === "map" && (
              <div className="grid gap-4 sm:grid-cols-2">
                {FEATURE_MAP.map((group) => (
                  <section
                    key={group.title}
                    aria-label={group.title}
                    className="grid content-start gap-1.5"
                  >
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                      {group.title}
                    </h3>
                    {group.features.map((feature) => (
                      <button
                        key={feature.href}
                        type="button"
                        onClick={() => openFeature(feature.href)}
                        className="hover:bg-muted/70 focus-visible:ring-ring/50 group flex items-start gap-2.5 rounded-lg p-2 text-left outline-none focus-visible:ring-3"
                      >
                        <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg border">
                          <feature.icon
                            className="size-4 text-violet-600 dark:text-violet-300"
                            aria-hidden
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{feature.label}</span>
                          <span className="text-muted-foreground block text-xs leading-snug">
                            {feature.text}
                          </span>
                        </span>
                      </button>
                    ))}
                  </section>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {step.kind === "welcome" ? (
                <Button variant="ghost" onClick={close}>
                  Più tardi
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => move(-1)} disabled={index === 0}>
                  <ArrowLeft aria-hidden />
                  Indietro
                </Button>
              )}
              {step.kind === "finale" ? (
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={close}>
                    Chiudi
                  </Button>
                  <Button data-tour-next onClick={startRecording}>
                    <Zap aria-hidden />
                    Registra un movimento
                  </Button>
                </div>
              ) : (
                <Button data-tour-next onClick={() => move(1)}>
                  {step.kind === "welcome" ? "Iniziamo" : last ? "Fine" : "Avanti"}
                  <ArrowRight aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {`Tappa ${index + 1} di ${total}: ${step.title}`}
        </p>
      </motion.div>
    </>,
    document.body,
  );
}
