"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "motion/react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  HandCoins,
  Hourglass,
  Mic,
  Play,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { PhoneFrame, SmartVideo } from "@/components/landing/devices";
import { Tilt, useSafeReducedMotion } from "@/components/landing/effects";
import { VIDEOS } from "@/components/landing/media";
import { cn } from "@/lib/utils";

export const DISPLAY = "font-[family-name:var(--font-display)] tracking-tight";

/** The logo: a small planet with its moon. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-semibold text-white", className)}>
      <span aria-hidden className="relative flex size-7 items-center justify-center">
        <span className="size-3.5 rounded-full bg-gradient-to-br from-indigo-300 via-violet-400 to-fuchsia-500 shadow-[0_0_18px_rgba(167,139,250,0.9)]" />
        <span
          className="lp-motion absolute inset-0"
          style={{ animation: "lp-orbit 4s linear infinite" }}
        >
          <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
        </span>
        <span className="absolute inset-0 rounded-full border border-white/15" />
      </span>
      <span className={DISPLAY}>FinTrack</span>
    </Link>
  );
}

/** Gradient call to action with a light sweeping across it. */
export function PrimaryCta({
  href,
  children,
  className,
  onHover,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onHover?: (on: boolean) => void;
}) {
  return (
    <Link
      href={href}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      onFocus={() => onHover?.(true)}
      onBlur={() => onHover?.(false)}
      className={cn(
        "group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 font-semibold text-white shadow-[0_0_40px_-6px_rgba(167,139,250,0.85)] transition-transform duration-300 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none",
        className,
      )}
    >
      <span
        aria-hidden
        className="lp-motion absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        style={{ animation: "lp-shimmer 3.2s ease-in-out infinite" }}
      />
      <span className="relative">{children}</span>
      <ArrowRight
        className="relative size-4 transition-transform group-hover:translate-x-1"
        aria-hidden
      />
    </Link>
  );
}

const NAV = [
  { href: "#funzioni", label: "Funzioni" },
  { href: "#video", label: "Video" },
  { href: "#ritrovati", label: "730" },
  { href: "#prezzi", label: "Prezzi" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  const { scrollY, scrollYProgress } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px] origin-left bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-300"
        style={{ scaleX: scrollYProgress }}
      />
      <nav
        aria-label="Principale"
        className={cn(
          "flex w-full max-w-5xl items-center justify-between gap-2 rounded-full border px-3 py-2 transition-all duration-500",
          scrolled
            ? "border-white/10 bg-[#07070f]/70 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)] backdrop-blur-xl"
            : "border-transparent",
        )}
      >
        <Logo className="pl-1" />
        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 text-sm text-white/75 transition-colors hover:text-white"
          >
            Accedi
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-[#07070f] transition-transform hover:scale-105"
          >
            Inizia gratis
          </Link>
        </div>
      </nav>
    </header>
  );
}

const WORDS = ["finalmente chiari.", "sotto controllo.", "in orbita.", "che tornano a te."];

function RotatingWords() {
  const reduce = useSafeReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), 2600);
    return () => clearInterval(id);
  }, [reduce]);
  return (
    <span aria-hidden className="relative block h-[1.1em]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={WORDS[index]}
          className="lp-gradient-text absolute inset-x-0 top-0 whitespace-nowrap lg:right-auto"
          initial={{ opacity: 0, y: "0.45em", filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: "-0.45em", filter: "blur(12px)" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const CHIPS: {
  icon: LucideIcon;
  text: string;
  className: string;
  delay: number;
  float: number;
  tint: string;
}[] = [
  {
    icon: Hourglass,
    text: "Sigarette 6,20 € = 27 min di lavoro",
    className: "-top-5 -left-1 lg:top-[9%] lg:left-auto lg:right-[84%]",
    delay: 0.9,
    float: 6,
    tint: "text-amber-300",
  },
  {
    icon: HandCoins,
    text: "Rimborso 730 stimato +68,93 €",
    className: "-bottom-5 -right-1 lg:bottom-auto lg:top-[33%] lg:right-auto lg:left-[84%]",
    delay: 1.1,
    float: 7,
    tint: "text-emerald-300",
  },
  {
    icon: Mic,
    text: "«ho speso 12 euro al bar»",
    className: "hidden lg:flex bottom-[30%] right-[86%]",
    delay: 1.3,
    float: 5.5,
    tint: "text-cyan-300",
  },
  {
    icon: CalendarClock,
    text: "Tra 45 giorni: mai sotto 912 €",
    className: "hidden lg:flex bottom-[10%] left-[82%]",
    delay: 1.5,
    float: 6.5,
    tint: "text-indigo-300",
  },
  {
    icon: Sparkles,
    text: "Coach: metti da parte 380 € il 27",
    className: "hidden lg:flex -bottom-[8%] left-1/2 -translate-x-1/2",
    delay: 1.7,
    float: 7.5,
    tint: "text-fuchsia-300",
  },
];

function HeroDevice() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, -70]);
  const reduce = useSafeReducedMotion();
  return (
    <motion.div
      style={reduce ? undefined : { y }}
      className="relative mx-auto w-full max-w-[300px] sm:max-w-[330px]"
    >
      {/* Orbits with their planets. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
      >
        {[
          { size: 430, seconds: 38, planet: "from-cyan-300 to-blue-500", dot: 14 },
          { size: 560, seconds: 55, planet: "from-fuchsia-300 to-violet-600", dot: 20 },
          { size: 700, seconds: 80, planet: "from-amber-200 to-orange-500", dot: 10 },
        ].map((orbit, i) => (
          <div
            key={orbit.size}
            className="lp-motion absolute top-1/2 left-1/2 rounded-full border border-dashed border-white/[0.09]"
            style={{
              width: orbit.size,
              height: orbit.size,
              marginLeft: -orbit.size / 2,
              marginTop: -orbit.size / 2,
              animation: `lp-orbit ${orbit.seconds}s linear infinite${i === 1 ? " reverse" : ""}`,
            }}
          >
            <span
              className={cn(
                "absolute top-1/2 -left-px rounded-full bg-gradient-to-br shadow-[0_0_24px_rgba(255,255,255,0.35)]",
                orbit.planet,
              )}
              style={{
                width: orbit.dot,
                height: orbit.dot,
                marginTop: -orbit.dot / 2,
                marginLeft: -orbit.dot / 2,
              }}
            />
          </div>
        ))}
        <div className="absolute top-1/2 left-1/2 size-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.45),transparent_65%)] blur-2xl" />
      </div>

      <div className="lp-rise" style={{ animationDelay: "0.35s" }}>
        <Tilt max={12}>
          <PhoneFrame>
            <SmartVideo
              src={VIDEOS.mobile.src}
              poster={VIDEOS.mobile.poster}
              label="FinTrack sul telefono: inserimento rapido, Soldi ritrovati e il mese in storie"
              buttonClassName="size-8 right-2 bottom-16"
            />
          </PhoneFrame>
        </Tilt>
      </div>

      {CHIPS.map(({ icon: Icon, text, className, delay, float, tint }) => (
        <motion.div
          key={text}
          aria-hidden
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={cn("absolute z-20 flex", className)}
        >
          <div
            className="lp-motion flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-3 py-2 text-xs whitespace-nowrap text-white/90 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:text-[13px]"
            style={{ animation: `lp-float ${float}s ease-in-out infinite` }}
          >
            <Icon className={cn("size-4 shrink-0", tint)} />
            {text}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-x-clip">
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 pt-32 pb-28 lg:grid-cols-[1.08fr_1fr] lg:pt-40 lg:pb-36">
        <div className="relative z-10 grid justify-items-center gap-7 text-center lg:justify-items-start lg:text-left">
          <a
            href="#ritrovati"
            className="lp-rise lp-glow-border inline-flex items-center gap-2 rounded-full bg-white/[0.04] py-1 pr-3 pl-1 text-sm text-white/80 backdrop-blur transition-colors hover:text-white"
            style={{ animationDelay: "0.05s" }}
          >
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
              Nuovo
            </span>
            {/* Shorter on phones, so the pill stays on one line. */}
            <span>
              <span className="hidden sm:inline">Soldi ritrovati: il 730</span>
              <span className="sm:hidden">Il 730</span> che si scrive da solo
            </span>
            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
          </a>

          <h1
            className={cn(
              DISPLAY,
              "lp-rise w-full text-[clamp(2.3rem,10.5vw,3rem)] leading-[1.04] font-semibold text-white sm:text-7xl",
            )}
            style={{ animationDelay: "0.15s" }}
          >
            <span className="sr-only">I tuoi soldi, finalmente chiari.</span>
            <span aria-hidden className="block">
              I tuoi soldi,
            </span>
            <RotatingWords />
          </h1>

          <p
            className="lp-rise max-w-xl text-lg text-pretty text-white/65"
            style={{ animationDelay: "0.3s" }}
          >
            Registri una spesa in tre secondi, anche a voce. FinTrack ti dice quanto ti costa in ore
            di lavoro, dove andrà il saldo e quanto ti torna dal 730. E un coach ti guida con le tue
            regole.
          </p>

          <div
            className="lp-rise flex flex-wrap justify-center gap-3 lg:justify-start"
            style={{ animationDelay: "0.45s" }}
          >
            <PrimaryCta href="/register">Decolla gratis</PrimaryCta>
            <a
              href="#video"
              className="group inline-flex h-12 items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] pr-5 pl-2 font-medium text-white backdrop-blur transition-colors hover:bg-white/[0.08]"
            >
              <span className="relative flex size-8 items-center justify-center rounded-full bg-white text-[#07070f]">
                <span
                  aria-hidden
                  className="lp-motion absolute inset-0 rounded-full bg-white/60"
                  style={{ animation: "lp-ping 2s cubic-bezier(0,0,0.2,1) infinite" }}
                />
                <Play className="relative size-3.5 translate-x-px" aria-hidden />
              </span>
              Guarda il video
              <span className="text-sm text-white/45">{VIDEOS.desktop.seconds} s</span>
            </a>
          </div>

          <ul
            className="lp-rise flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-white/55 lg:justify-start"
            style={{ animationDelay: "0.6s" }}
          >
            {["Gratis per sempre", "Nessun collegamento alla banca", "Dati in Europa"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-300" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <HeroDevice />
      </div>

      {/* A planet rising at the bottom of the scene. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-64 overflow-hidden [mask-image:linear-gradient(#000_45%,transparent)]"
      >
        <div className="absolute top-20 left-1/2 h-[1200px] w-[2400px] -translate-x-1/2 rounded-[50%] bg-[#05050c] shadow-[0_-40px_140px_-30px_rgba(129,140,248,0.75),inset_0_2px_0_rgba(196,181,253,0.55)]" />
      </div>
    </section>
  );
}
