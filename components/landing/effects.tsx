"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  animate,
  motion,
  MotionConfig,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

/**
 * "Reduce motion" as set in the system, but only after hydration: the server can't know it, and
 * rendering differently on the first client pass breaks hydration.
 */
export function useSafeReducedMotion() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && reduce === true;
}

/** Motion follows the system setting: no movement, only fades, for who asked for less motion. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fades and lifts its content into place the first time it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

/** A soft light that follows the mouse across the whole page (desktop only). */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current!;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    let tx = x;
    let ty = y;
    let frame = 0;
    const tick = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.transform = `translate3d(${x - 300}px, ${y - 300}px, 0)`;
      frame = requestAnimationFrame(tick);
    };
    const onMove = (e: globalThis.PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      el.style.opacity = "1";
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-0 size-[600px] rounded-full opacity-0 transition-opacity duration-700"
      style={{
        background: "radial-gradient(circle, rgba(129,140,248,0.13), transparent 60%)",
      }}
    />
  );
}

/** Slowly drifting nebulae behind everything. */
export function Nebula() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      <div
        className="lp-motion absolute -top-[20%] -left-[10%] size-[70vmax] rounded-full opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(99,102,241,0.55), transparent 60%)",
          animation: "lp-drift-a 26s ease-in-out infinite",
        }}
      />
      <div
        className="lp-motion absolute top-[30%] -right-[20%] size-[60vmax] rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(217,70,239,0.5), transparent 60%)",
          animation: "lp-drift-b 32s ease-in-out infinite",
        }}
      />
      <div
        className="lp-motion absolute -bottom-[30%] left-[20%] size-[60vmax] rounded-full opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(34,211,238,0.45), transparent 60%)",
          animation: "lp-drift-a 38s ease-in-out infinite reverse",
        }}
      />
      <div className="lp-grain absolute inset-0 opacity-[0.07] mix-blend-overlay" />
    </div>
  );
}

/** A glass card with a light that follows the pointer inside it. */
export function SpotlightCard({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const rect = ref.current!.getBoundingClientRect();
    ref.current!.style.setProperty("--x", `${e.clientX - rect.left}px`);
    ref.current!.style.setProperty("--y", `${e.clientY - rect.top}px`);
  }
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl transition-[border-color,transform] duration-500 hover:-translate-y-1 hover:border-white/20",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at var(--x) var(--y), rgba(167,139,250,0.16), transparent 45%)",
        }}
      />
      {children}
    </div>
  );
}

/** Tilts its content in 3D towards the pointer. */
export function Tilt({
  children,
  className,
  max = 10,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const reduce = useSafeReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), {
    stiffness: 120,
    damping: 14,
  });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), {
    stiffness: 120,
    damping: 14,
  });
  return (
    <motion.div
      className={className}
      style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 1100 }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - rect.left) / rect.width - 0.5);
        py.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Counts from 0 to `to` when it scrolls into view. */
export function CountUp({
  to,
  format = (n) => String(Math.round(n)),
  duration = 1.6,
}: {
  to: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useSafeReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setValue });
    return () => controls.stop();
  }, [inView, reduce, to, duration]);
  return <span ref={ref}>{format(value)}</span>;
}

/** An endless horizontal strip (the content is repeated twice); pauses on hover. */
export function Marquee({
  children,
  reverse = false,
  seconds = 40,
  className,
}: {
  children: ReactNode;
  reverse?: boolean;
  seconds?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]",
        className,
      )}
    >
      {/* Two identical copies: shifting by half the track loops seamlessly. Longhand animation
          properties, so the hover class can still pause it. */}
      <div
        className="lp-motion flex w-max group-hover:[animation-play-state:paused]"
        style={{
          animationName: "lp-marquee",
          animationDuration: `${seconds}s`,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        <div className="flex shrink-0 gap-4 pr-4">{children}</div>
        {/* The copy is only visual: hidden from screen readers and out of the tab order. */}
        <div
          aria-hidden
          // React 18 doesn't render `inert` yet: set the attribute directly.
          ref={(el) => el?.setAttribute("inert", "")}
          className="flex shrink-0 gap-4 pr-4"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
