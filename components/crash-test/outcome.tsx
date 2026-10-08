"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrashChart, monthAt, TONE_COLORS } from "@/components/crash-test/crash-chart";
import { renderCrashCard } from "@/components/crash-test/share-card";
import { baselineProjection, type Projection, type Tone } from "@/lib/finance/crash-test";
import { parseAmount } from "@/lib/finance/money";
import type { CrashTestData } from "@/lib/data/crash-test";
import { cn } from "@/lib/utils";

/* What every scenario of the crash test ends with: verdict, chart and the image to share. */

const monthYear = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "meno di un mese", "1 mese", "7 mesi". */
export const monthsText = (held: number) =>
  held < 1 ? "meno di un mese" : Math.floor(held) === 1 ? "1 mese" : `${Math.floor(held)} mesi`;

/** "maggio 2027": when the money runs out, `held` months from the start of this month. */
export const runOutMonth = (start: string, held: number) =>
  monthYear.format(monthAt(start, Math.floor(held)));

export const parseNumber = (v: string) => {
  const parsed = parseAmount(v);
  return parsed === null ? null : Number(parsed);
};

const TONE_BOX: Record<Tone, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/5",
  warn: "border-amber-500/50 bg-amber-500/10",
  danger: "border-red-500/40 bg-red-500/10",
};
const TONE_TEXT: Record<Tone, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  warn: "text-(--warn-text)",
  danger: "text-red-700 dark:text-red-400",
};

/** The result of a scenario: verdict, details, chart and the image to share. */
export function Outcome({
  data,
  title,
  tone,
  children,
  projection,
  share,
}: {
  data: CrashTestData;
  title: string;
  tone: Tone;
  children?: ReactNode;
  projection: Projection;
  share: { scenario: string; verdict: string; detail: string };
}) {
  const baseline = useMemo(() => baselineProjection(data.baseline), [data.baseline]);
  const [sharing, setSharing] = useState(false);

  async function onShare() {
    setSharing(true);
    try {
      const blob = await renderCrashCard({ ...share, tone });
      const file = new File([blob], "fintrack-crash-test.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Il mio crash test su FinTrack" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") console.error(error);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="grid content-start gap-4">
      <div className={cn("grid gap-2 rounded-2xl border p-5", TONE_BOX[tone])} aria-live="polite">
        <p className={cn("text-3xl font-bold tracking-tight", TONE_TEXT[tone])}>{title}</p>
        {children}
      </div>
      <div className="bg-card grid gap-2 rounded-2xl border p-4">
        <CrashChart
          start={data.start}
          scenario={projection.balances}
          baseline={baseline.balances}
          held={projection.held}
          tone={tone}
        />
        <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: TONE_COLORS[tone] }} />{" "}
            Con lo scenario
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed" /> Se non succede niente
          </span>
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        onClick={onShare}
        disabled={sharing}
      >
        {typeof navigator !== "undefined" && "share" in navigator ? <Share2 /> : <Download />}
        {sharing ? "Preparo l'immagine…" : "Condividi il risultato, senza importi"}
      </Button>
    </div>
  );
}
