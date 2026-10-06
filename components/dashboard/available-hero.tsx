import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AnimatedCurrency } from "@/components/dashboard/animated-currency";

/**
 * The first thing on the dashboard: the money you can spend (every account except investments,
 * which have their own card), next to a small planet with moons in orbit.
 */
export function AvailableHero({
  value,
  accountCount,
  hasInvestments,
}: {
  value: number;
  accountCount: number;
  hasInvestments: boolean;
}) {
  return (
    <section
      aria-label="Soldi disponibili"
      className="bg-card relative overflow-hidden rounded-2xl border p-6 sm:p-8"
    >
      <Orbits />
      <div className="relative">
        {/* On phones the planet sits in the top corner: this row keeps the number below it. */}
        <p className="text-muted-foreground min-h-12 text-sm sm:min-h-0">Soldi disponibili</p>
        <AnimatedCurrency
          value={value}
          className="app-number font-display mt-1 block text-5xl font-semibold tracking-tight tabular-nums sm:text-7xl"
        />
        <Link
          href="/accounts"
          className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1 text-sm"
        >
          Somma di {accountCount === 1 ? "1 conto" : `${accountCount} conti`}
          {hasInvestments && ", investimenti esclusi"}
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

const TILT = "rotateZ(-16deg) rotateX(66deg)";

/**
 * A planet seen at an angle, with two moons. The orbits live in one 3D scene, so the moons pass
 * behind the planet and in front of it; each moon spins backwards to stay round.
 */
function Orbits() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-[-114px] right-[-114px] size-80 scale-[0.55] sm:top-1/2 sm:right-[-1rem] sm:-translate-y-1/2 sm:scale-100"
    >
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(129,140,248,0.32),transparent_62%)]" />
      <div className="absolute inset-0 [perspective:900px]">
        <div className="absolute inset-0 [transform-style:preserve-3d]" style={{ transform: TILT }}>
          <Orbit inset="0.75rem" seconds={22} start={150} moon="#67e8f9" size={10} />
          <Orbit inset="3.75rem" seconds={13} start={230} moon="#f0abfc" size={8} reverse />
          <div
            className="absolute top-1/2 left-1/2 -mt-11 -ml-11 size-22 rounded-full"
            style={{
              transform: "rotateX(-66deg)",
              background:
                "radial-gradient(circle at 32% 28%, #eef2ff, #a5b4fc 20%, #6366f1 46%, #4c1d95 78%, #1e1b4b)",
              boxShadow:
                "0 0 60px rgba(129,140,248,0.55), inset -10px -12px 22px rgba(15,10,40,0.55)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** `start`: where the moon is when still (reduced motion), in degrees from the far side. */
function Orbit({
  inset,
  seconds,
  start,
  moon,
  size,
  reverse = false,
}: {
  inset: string;
  seconds: number;
  start: number;
  moon: string;
  size: number;
  reverse?: boolean;
}) {
  const spin = `${seconds}s linear infinite${reverse ? " reverse" : ""}`;
  return (
    <>
      <div
        className="absolute rounded-full border border-indigo-400/30 dark:border-indigo-300/25"
        style={{ inset }}
      />
      <div
        className="lp-motion app-orbit absolute [transform-style:preserve-3d]"
        style={
          {
            inset,
            "--orbit-start": `${start}deg`,
            rotate: `${start}deg`,
            animation: `app-spin ${spin}`,
          } as CSSProperties
        }
      >
        <span
          className="lp-motion app-orbit absolute top-0 left-1/2 rounded-full"
          style={{
            width: size,
            height: size,
            marginTop: -size / 2,
            marginLeft: -size / 2,
            background: moon,
            boxShadow: `0 0 12px ${moon}`,
            rotate: `${-start}deg`,
            transform: "rotateX(-66deg)",
            animation: `app-spin-back ${spin}`,
          }}
        />
      </div>
    </>
  );
}
