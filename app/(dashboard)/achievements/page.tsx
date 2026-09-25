import { Flame, Sparkles } from "lucide-react";
import { BadgeMedal } from "@/components/gamification/badges";
import { Meter } from "@/components/planning/meter";
import { requireUser } from "@/lib/auth/session";
import { getGamification } from "@/lib/data/gamification";
import { cn } from "@/lib/utils";

export const metadata = { title: "Traguardi · FinTrack" };

const weekday = new Intl.DateTimeFormat("it-IT", { weekday: "narrow", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export default async function AchievementsPage() {
  const user = await requireUser();
  const { streak, badges, level, unlocked } = await getGamification(user.id);
  const toNext = level.nextMin !== null ? level.nextMin - level.xp : 0;

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Traguardi</h1>
        <p className="text-muted-foreground text-sm">
          Piccole abitudini, grandi risultati: ogni movimento registrato conta.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section
          className="bg-card relative grid gap-4 overflow-hidden rounded-2xl border p-5"
          aria-labelledby="level-title"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-10 size-56 rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(circle, #a855f7, transparent 70%)" }}
          />
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400">
              <Sparkles className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-muted-foreground text-sm" id="level-title">
                Livello {level.level}
              </p>
              <p className="text-2xl font-semibold tracking-tight">{level.name}</p>
            </div>
          </div>
          <Meter
            value={level.progress}
            color="#a855f7"
            label={`Avanzamento verso il livello successivo`}
          />
          <p className="text-muted-foreground text-sm">
            {level.nextName
              ? `${level.xp} punti · ancora ${toNext} per diventare «${level.nextName}»`
              : `${level.xp} punti · hai raggiunto il livello massimo!`}
          </p>
        </section>

        <section
          className="bg-card grid gap-4 rounded-2xl border p-5"
          aria-labelledby="streak-title"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
              <Flame className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-muted-foreground text-sm" id="streak-title">
                Streak attuale
              </p>
              <p className="text-2xl font-semibold tracking-tight">
                {streak.current} {streak.current === 1 ? "giorno" : "giorni"}
              </p>
            </div>
            <p className="text-muted-foreground ml-auto text-right text-sm">
              Record
              <br />
              <span className="text-foreground font-medium">
                {streak.longest} {streak.longest === 1 ? "giorno" : "giorni"}
              </span>
            </p>
          </div>
          <ol className="grid grid-cols-14 gap-1" aria-label="Ultimi 14 giorni">
            {streak.recent.map((d) => (
              <li key={d.date} className="grid justify-items-center gap-1">
                <span
                  title={`${fullDay.format(new Date(`${d.date}T00:00:00Z`))}: ${d.active ? "registrato" : "niente"}`}
                  className={cn("size-5 rounded-md", d.active ? "bg-orange-500" : "bg-muted")}
                />
                <span className="text-muted-foreground text-[10px] uppercase" aria-hidden>
                  {weekday.format(new Date(`${d.date}T00:00:00Z`))}
                </span>
                <span className="sr-only">
                  {fullDay.format(new Date(`${d.date}T00:00:00Z`))}:{" "}
                  {d.active ? "registrato" : "niente"}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground text-sm">
            {streak.activeToday
              ? "Oggi ci sei già: ottimo!"
              : streak.current > 0
                ? "Registra un movimento oggi per non perdere la streak."
                : "Registra un movimento oggi per iniziare una nuova streak."}
          </p>
        </section>
      </div>

      <section aria-labelledby="badges-title" className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="badges-title" className="font-medium">
            Badge
          </h2>
          <p className="text-muted-foreground text-sm">
            {unlocked} di {badges.length} sbloccati
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge) => (
            <li
              key={badge.id}
              className={cn(
                "bg-card flex items-center gap-3 rounded-xl border p-4",
                !badge.unlocked && "opacity-75",
              )}
            >
              <BadgeMedal badge={badge} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{badge.name}</p>
                <p className="text-muted-foreground text-xs">{badge.description}</p>
                {!badge.unlocked && badge.progress && (
                  <div className="mt-2 grid gap-1">
                    <Meter
                      value={badge.progress.value / badge.progress.target}
                      label={`${badge.name}: ${badge.progress.value} su ${badge.progress.target}`}
                      className="h-1.5"
                    />
                    <p className="text-muted-foreground text-[11px] tabular-nums">
                      {badge.progress.value} / {badge.progress.target}
                    </p>
                  </div>
                )}
              </div>
              <span className="sr-only">{badge.unlocked ? "Sbloccato" : "Da sbloccare"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
