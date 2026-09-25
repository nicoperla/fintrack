import Link from "next/link";
import { Flame, Sparkles } from "lucide-react";
import type { Gamification } from "@/lib/gamification/engine";
import { cn } from "@/lib/utils";

/** Streak + level summary shown next to the greeting; links to the achievements page. */
export function ProgressChips({ data }: { data: Gamification }) {
  const { streak, level } = data;
  const atRisk = streak.current > 0 && !streak.activeToday;
  return (
    <Link
      href="/achievements"
      className="hover:bg-muted/60 flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors"
      title={atRisk ? "Registra un movimento oggi per non perdere la streak" : undefined}
    >
      <span className="flex items-center gap-1 font-medium">
        <Flame
          className={cn("size-4", streak.current > 0 ? "text-orange-500" : "text-muted-foreground")}
          aria-hidden
        />
        {streak.current}
        <span className="sr-only">
          {streak.current === 1 ? "giorno di fila" : "giorni di fila"}
          {atRisk && ", registra qualcosa oggi per non perderla"}
        </span>
        {atRisk && <span aria-hidden className="size-1.5 rounded-full bg-orange-500" />}
      </span>
      <span aria-hidden className="bg-border h-4 w-px" />
      <span className="text-muted-foreground flex items-center gap-1">
        <Sparkles className="size-4" aria-hidden />
        Liv. {level.level}
        <span className="text-foreground hidden font-medium sm:inline">· {level.name}</span>
      </span>
    </Link>
  );
}
