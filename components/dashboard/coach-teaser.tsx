"use client";

import Link from "next/link";
import { ChevronRight, HandCoins, Sparkles } from "lucide-react";
import { useMoney } from "@/components/currency-provider";
import { MaskedText } from "@/components/amount";
import { ScoreRing } from "@/components/coach/coach-overview";
import type { CoachReport } from "@/lib/finance/coach";

/** The coach's verdict in one card, with its most urgent tip. */
export function CoachTeaser({ report }: { report: CoachReport }) {
  const tip = report.tips[0];
  return (
    <Link
      href="/coach"
      className="bg-card hover:bg-muted/40 group flex items-center gap-4 rounded-xl border p-4 transition-colors"
    >
      <ScoreRing score={report.score} size={64} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Sparkles className="size-3.5" aria-hidden /> Il tuo coach · {report.scoreLabel}
        </p>
        {tip ? (
          <>
            <p className="font-medium">
              <MaskedText text={tip.title} />
            </p>
            <p className="text-muted-foreground line-clamp-2 text-sm">
              <MaskedText text={tip.body} />
            </p>
          </>
        ) : (
          <p className="font-medium">{report.headline}</p>
        )}
      </div>
      <ChevronRight
        className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

/** Instagram-style bubble: last month, told in stories. */
export function StoryBubble({ monthKey, monthName }: { monthKey: string; monthName: string }) {
  return (
    <Link
      href={`/stories?month=${monthKey}`}
      className="group flex items-center gap-2.5 rounded-full pr-3 text-sm"
      aria-label={`Guarda il tuo ${monthName} in storie`}
    >
      <span
        className="rounded-full p-[2.5px] group-hover:[animation-play-state:paused] motion-safe:animate-[spin_6s_linear_infinite]"
        style={{ background: "conic-gradient(#f59e0b, #db2777, #7c3aed, #2563eb, #f59e0b)" }}
      >
        <span className="bg-background flex size-10 items-center justify-center rounded-full p-0.5 motion-safe:animate-[spin_6s_linear_infinite_reverse]">
          <span
            className="flex size-full items-center justify-center rounded-full text-[11px] font-bold text-white uppercase"
            style={{ background: "linear-gradient(160deg, #4f46e5, #db2777)" }}
          >
            {monthName.slice(0, 3)}
          </span>
        </span>
      </span>
      <span className="leading-tight">
        <span className="text-muted-foreground block text-xs">Il tuo {monthName}</span>
        <span className="font-medium">in storie</span>
      </span>
    </Link>
  );
}

/** "Soldi ritrovati" in one line: the counter that keeps growing with every receipt. */
export function FoundMoneyTeaser({
  year,
  total,
  refund,
  extras,
}: {
  year: number;
  total: number;
  refund: number;
  /** Other findings, e.g. "1 doppio addebito". */
  extras: string[];
}) {
  return (
    <Link
      href="/ritrovati"
      className="group relative flex items-center gap-4 overflow-hidden rounded-xl p-4 text-white"
      style={{ background: "linear-gradient(135deg, #047857, #0d9488 55%, #0369a1)" }}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15">
        <HandCoins className="size-6" aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-xs text-white/80">Soldi ritrovati nel {year}</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          <MaskedAmount value={total} />
        </p>
        <p className="truncate text-sm text-white/85">
          {[refund > 0 ? "rimborso 730 stimato" : null, ...extras].filter(Boolean).join(" · ")}
        </p>
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-white/80 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

function MaskedAmount({ value }: { value: number }) {
  const money = useMoney();
  return <>{money(value)}</>;
}
