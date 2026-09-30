"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Flame,
  Lightbulb,
  Scissors,
} from "lucide-react";
import { MaskedText } from "@/components/amount";
import { useWholeMoney, useWorkTime } from "@/components/currency-provider";
import { CategoryIcon } from "@/lib/category-style";
import type { CoachPillar, CoachReport, CoachTip } from "@/lib/finance/coach";
import { cn } from "@/lib/utils";

export const scoreColor = (score: number) =>
  score >= 80
    ? "var(--delta-good)"
    : score >= 60
      ? "var(--viz-income)"
      : score >= 40
        ? "var(--meter-warn)"
        : "var(--delta-bad)";

/** The health score as a ring that fills up on arrival. */
export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const stroke = size / 11;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold tabular-nums" style={{ fontSize: size / 3.4 }}>
          {score}
        </span>
        <span className="text-muted-foreground text-xs">su 100</span>
      </div>
    </div>
  );
}

function PillarBar({ pillar }: { pillar: CoachPillar }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{pillar.label}</span>
        <span className="text-muted-foreground tabular-nums">{Math.round(pillar.score)}</span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(3, pillar.score)}%`, background: scoreColor(pillar.score) }}
        />
      </div>
      <p className="text-muted-foreground text-xs">{pillar.detail}</p>
    </div>
  );
}

export function CoachScore({ report }: { report: CoachReport }) {
  return (
    <section
      className="bg-card relative grid gap-6 overflow-hidden rounded-2xl border p-5 sm:p-6"
      aria-label="Salute finanziaria"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 -left-20 size-72 rounded-full opacity-15 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${scoreColor(report.score)}, transparent 70%)`,
        }}
      />
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <ScoreRing score={report.score} />
        <div className="grid gap-1">
          <p className="text-muted-foreground text-sm">La tua salute finanziaria</p>
          <p className="text-2xl font-semibold tracking-tight">{report.scoreLabel}</p>
          <p className="text-muted-foreground max-w-md">{report.headline}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
        {report.pillars.map((p) => (
          <PillarBar key={p.id} pillar={p} />
        ))}
      </div>
    </section>
  );
}

const TIP_STYLE: Record<CoachTip["kind"], { icon: typeof Lightbulb; className: string }> = {
  alert: { icon: AlertTriangle, className: "bg-(--delta-bad)/10 text-(--delta-bad)" },
  warn: { icon: CircleAlert, className: "bg-amber-500/10 text-(--warn-text)" },
  good: { icon: CircleCheck, className: "bg-(--delta-good)/10 text-(--delta-good)" },
  idea: { icon: Lightbulb, className: "bg-(--viz-income)/10 text-(--viz-income)" },
};

export function CoachTips({ tips }: { tips: CoachTip[] }) {
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {tips.map((tip, i) => {
        const style = TIP_STYLE[tip.kind];
        const Icon = style.icon;
        return (
          <li
            key={tip.id}
            className="bg-card motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both flex gap-3 rounded-xl border p-4"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                style.className,
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="grid min-w-0 gap-1">
              <p className="font-medium">
                <MaskedText text={tip.title} />
              </p>
              <p className="text-muted-foreground text-sm">
                <MaskedText text={tip.body} />
              </p>
              {tip.href && (
                <Link
                  href={tip.href}
                  className="text-primary mt-1 inline-flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  {tip.hrefLabel ?? "Apri"}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CoachPlan({ plan }: { plan: CoachReport["plan"] }) {
  const money = useWholeMoney();
  const format = (value: number, unit: string) =>
    unit === "pct"
      ? `${Math.round(value)}%`
      : unit === "money"
        ? money(Math.round(value))
        : unit === "months"
          ? `${value.toFixed(1).replace(".", ",")} mesi`
          : String(Math.round(value));

  return (
    <section
      className="bg-card grid content-start gap-4 rounded-xl border p-4"
      aria-labelledby="plan-title"
    >
      <div>
        <p className="text-muted-foreground text-xs tracking-wide uppercase">Il tuo metodo</p>
        <h2 id="plan-title" className="font-medium">
          {plan.title}
        </h2>
        <p className="text-muted-foreground text-sm">{plan.summary}</p>
      </div>
      <div className="grid gap-4">
        {plan.rows.map((row) => {
          const good =
            row.direction === "max" ? row.actual <= row.target : row.actual >= row.target;
          const scale = Math.max(row.target, row.actual, 1) * 1.15;
          return (
            <div key={row.label} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>{row.label}</span>
                <span className="tabular-nums">
                  <span
                    className={cn(
                      "font-medium",
                      good ? "text-(--delta-good)" : "text-(--delta-bad)",
                    )}
                  >
                    {format(row.actual, row.unit)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    / {row.direction === "max" ? "max" : "obiettivo"} {format(row.target, row.unit)}
                  </span>
                </span>
              </div>
              <div className="bg-muted relative h-2 rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (Math.max(0, row.actual) / scale) * 100)}%`,
                    background: good ? "var(--delta-good)" : "var(--meter-warn)",
                  }}
                />
                <div
                  aria-hidden
                  className="bg-foreground absolute -top-1 h-4 w-0.5 rounded-full"
                  style={{ left: `${(row.target / scale) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {plan.note && <p className="text-muted-foreground text-xs">{plan.note}</p>}
    </section>
  );
}

export function CoachCuts({ report }: { report: CoachReport }) {
  const money = useWholeMoney();
  const workTime = useWorkTime();
  if (report.cuts.length === 0) return null;
  const yearlyWork = workTime(report.cutsTotal * 12);
  return (
    <section
      className="bg-card grid content-start gap-4 rounded-xl border p-4"
      aria-labelledby="cuts-title"
    >
      <div>
        <h2 id="cuts-title" className="flex items-center gap-2 font-medium">
          <Scissors className="size-4" aria-hidden /> Dove taglierei
        </h2>
        <p className="text-muted-foreground text-sm">
          Solo tra i desideri, senza toccare quello che hai protetto.
        </p>
      </div>
      <ul className="grid gap-3">
        {report.cuts.map((c) => (
          <li key={c.id} className="flex items-center gap-3">
            <CategoryIcon name={c.icon} color={c.color} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="text-muted-foreground text-xs tabular-nums">
                da {money(Math.round(c.average))} a {money(Math.round(c.average - c.cut))} al mese
              </p>
            </div>
            <span className="text-sm font-medium text-(--delta-good) tabular-nums">
              −{money(c.cut)}
            </span>
          </li>
        ))}
      </ul>
      <div className="bg-muted/60 rounded-lg p-3 text-sm">
        In tutto <span className="font-semibold tabular-nums">{money(report.cutsTotal)}</span> al
        mese, <span className="font-semibold tabular-nums">{money(report.cutsTotal * 12)}</span>{" "}
        all&apos;anno
        {yearlyWork ? `: ${yearlyWork} di lavoro che ti riprendi.` : "."}
      </div>
    </section>
  );
}

export function CoachChallenge({ challenge }: { challenge: CoachReport["challenge"] }) {
  return (
    <section
      className="relative overflow-hidden rounded-xl border p-4"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklch, var(--viz-expense) 14%, var(--card)), var(--card) 65%)",
      }}
      aria-label="Sfida della settimana"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--viz-expense) text-white"
        >
          <Flame className="size-5" />
        </span>
        <div className="grid gap-1">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Sfida della settimana
          </p>
          <p className="font-medium">{challenge.title}</p>
          <p className="text-muted-foreground text-sm">
            <MaskedText text={challenge.body} />
          </p>
        </div>
      </div>
    </section>
  );
}
