"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Download,
  Feather,
  Flame,
  Gem,
  HeartHandshake,
  House,
  MapPin,
  PartyPopper,
  Plane,
  Repeat,
  RotateCcw,
  Scale,
  Share2,
  ShoppingBag,
  Sprout,
  TrainFront,
  Trophy,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCountUp } from "@/components/dashboard/animated-currency";
import { useMoney, useWholeMoney, useWorkTime } from "@/components/currency-provider";
import { CATEGORY_ICONS, type CategoryIconName } from "@/lib/category-style";
import type { ArchetypeId } from "@/lib/finance/stories";
import type { StoryPage } from "@/lib/data/stories";
import { renderStoryCard } from "@/components/stories/story-card";
import { cn } from "@/lib/utils";

const SLIDE_MS = 6000;

export const ARCHETYPE_ICONS: Record<ArchetypeId, LucideIcon> = {
  generoso: HeartHandshake,
  zen: Sprout,
  minimalista: Feather,
  buongustaio: UtensilsCrossed,
  esploratore: Plane,
  shopping: ShoppingBag,
  festa: PartyPopper,
  ribelle: Flame,
  collezionista: Repeat,
  esteta: Gem,
  pilastro: House,
  pendolare: TrainFront,
  equilibrista: Scale,
};

const GRADIENTS = [
  "linear-gradient(160deg, #4f46e5, #7c3aed 55%, #db2777)",
  "linear-gradient(160deg, #0f766e, #0891b2 60%, #2563eb)",
  "linear-gradient(160deg, #15803d, #0d9488 60%, #0369a1)",
  "linear-gradient(160deg, #c2410c, #e11d48 60%, #9333ea)",
  "linear-gradient(160deg, #1e3a8a, #4338ca 55%, #0e7490)",
  "linear-gradient(160deg, #9f1239, #be123c 50%, #ea580c)",
  "linear-gradient(160deg, #0369a1, #6d28d9 60%, #be185d)",
  "linear-gradient(160deg, #3f3f46, #1e293b 55%, #0f766e)",
];

const dayLong = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const formatDay = (iso: string) => dayLong.format(new Date(`${iso}T00:00:00Z`));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (n: number) => `${Math.round(n)}%`;

function CountUpMoney({ value }: { value: number }) {
  const whole = useWholeMoney();
  const shown = useCountUp(value, 1200);
  return <>{whole(shown)}</>;
}

function Big({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-5xl leading-none font-bold tracking-tight tabular-nums sm:text-6xl",
        className,
      )}
    >
      {children}
    </p>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-lg font-medium text-white/80">{children}</p>;
}

function CategoryGlyph({ icon, className }: { icon: string | null; className?: string }) {
  const Icon: LucideIcon = (icon && CATEGORY_ICONS[icon as CategoryIconName]) || Crown;
  return <Icon className={className} aria-hidden />;
}

type Slide = { id: string; content: ReactNode };

export function StoryViewer({ page }: { page: StoryPage }) {
  const router = useRouter();
  const money = useMoney();
  const whole = useWholeMoney();
  const workTime = useWorkTime();
  const { story, monthName, previousMonthName, year } = page;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sharing, setSharing] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const held = useRef(false);

  const top = story.categories[0];
  const ArchetypeIcon = ARCHETYPE_ICONS[story.archetype.id];

  const slides = useMemo(() => {
    const list: Slide[] = [];
    list.push({
      id: "intro",
      content: (
        <div className="grid gap-6">
          <Kicker>{page.isCurrent ? "Finora, il tuo" : "Il tuo"}</Kicker>
          <Big className="text-6xl sm:text-7xl">{capitalize(monthName)}</Big>
          <p className="text-2xl font-semibold text-white/90">{year}</p>
          <p className="max-w-xs text-lg text-white/80">
            {story.count} movimenti raccontano il tuo mese. Tocca per iniziare.
          </p>
        </div>
      ),
    });

    if (story.income > 0 || story.expense > 0) {
      const max = Math.max(story.income, story.expense, 1);
      list.push({
        id: "flow",
        content: (
          <div className="grid gap-8">
            <div className="grid gap-2">
              <Kicker>Sono entrati</Kicker>
              <Big>
                <CountUpMoney value={story.income} />
              </Big>
              <div className="h-3 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full origin-left rounded-full bg-white motion-safe:animate-[grow_1.2s_ease-out_both]"
                  style={{ width: `${(story.income / max) * 100}%` }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Kicker>e ne sono usciti</Kicker>
              <Big>
                <CountUpMoney value={story.expense} />
              </Big>
              <div className="h-3 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full origin-left rounded-full bg-white/70 motion-safe:animate-[grow_1.2s_ease-out_both]"
                  style={{ width: `${(story.expense / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ),
      });
    }

    if (story.income > 0) {
      list.push({
        id: "saved",
        content:
          story.saved >= 0 ? (
            <div className="grid gap-5">
              <Kicker>Hai messo da parte</Kicker>
              <Big className="text-6xl sm:text-7xl">
                <CountUpMoney value={story.saved} />
              </Big>
              <p className="text-2xl font-semibold">{pct(story.savingsRate ?? 0)} delle entrate</p>
              <p className="text-lg text-white/80">
                {(story.savingsRate ?? 0) >= 20
                  ? "Sopra la soglia d'oro del 20%. Applausi."
                  : "Ogni euro risparmiato è un passo avanti."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              <Kicker>Questo mese hai speso</Kicker>
              <Big>
                <CountUpMoney value={-story.saved} />
              </Big>
              <p className="text-2xl font-semibold">più di quanto è entrato</p>
              <p className="text-lg text-white/80">
                Succede. Il coach ha qualche idea per il prossimo.
              </p>
            </div>
          ),
      });
    }

    if (top) {
      const work = workTime(top.amount);
      list.push({
        id: "top",
        content: (
          <div className="grid gap-5">
            <Kicker>Il protagonista del mese</Kicker>
            <span className="flex size-24 items-center justify-center rounded-3xl bg-white/15 motion-safe:animate-[pop_0.6s_ease-out_both]">
              <CategoryGlyph icon={top.icon} className="size-12" />
            </span>
            <Big className="text-4xl sm:text-5xl">{top.name}</Big>
            <p className="text-2xl font-semibold tabular-nums">{money(top.amount)}</p>
            <p className="text-lg text-white/80">
              Il {pct(top.share * 100)} di tutte le spese
              {work ? `: ${work} di lavoro.` : "."}
            </p>
          </div>
        ),
      });
    }

    if (story.categories.length >= 3) {
      list.push({
        id: "podium",
        content: (
          <div className="grid gap-6">
            <Kicker>La tua top 5</Kicker>
            <ol className="grid gap-4">
              {story.categories.map((c, i) => (
                <li
                  key={c.id}
                  className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-6 motion-safe:fill-mode-both grid gap-1.5"
                  style={{ animationDelay: `${200 + i * 150}ms`, animationDuration: "500ms" }}
                >
                  <div className="flex items-center gap-3 text-lg">
                    <span className="w-6 font-bold text-white/60">{i + 1}</span>
                    <CategoryGlyph icon={c.icon} className="size-5" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                    <span className="tabular-nums">{pct(c.share * 100)}</span>
                  </div>
                  <div className="ml-9 h-2 rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${(c.amount / story.categories[0].amount) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ),
      });
    }

    if (story.biggest) {
      list.push({
        id: "biggest",
        content: (
          <div className="grid gap-5">
            <Kicker>La spesa più grande</Kicker>
            <Big>{money(story.biggest.amount)}</Big>
            <p className="text-3xl font-semibold">{story.biggest.description}</p>
            <p className="text-lg text-white/80">
              {capitalize(formatDay(story.biggest.date))}
              {story.biggest.category ? `, in ${story.biggest.category.name}` : ""}.
            </p>
          </div>
        ),
      });
    }

    if (story.place) {
      list.push({
        id: "place",
        content: (
          <div className="grid gap-5">
            <Kicker>Il tuo posto del cuore</Kicker>
            <MapPin className="size-14 motion-safe:animate-bounce" aria-hidden />
            <Big className="text-4xl sm:text-5xl">{story.place.name}</Big>
            <p className="text-2xl font-semibold">{story.place.count} volte questo mese</p>
            <p className="text-lg text-white/80">Per {money(story.place.amount)} in tutto.</p>
          </div>
        ),
      });
    }

    if (story.weekday && story.priciestDay) {
      list.push({
        id: "days",
        content: (
          <div className="grid gap-8">
            <div className="grid gap-3">
              <Kicker>Il giorno in cui spendi di più è il</Kicker>
              <Big className="text-5xl capitalize">{story.weekday.name}</Big>
              <p className="text-lg text-white/80">
                {pct(story.weekday.share * 100)} delle spese del mese.
              </p>
            </div>
            <div className="grid gap-2 border-t border-white/20 pt-6">
              <Kicker>Il giorno più caro</Kicker>
              <p className="text-3xl font-semibold">
                {capitalize(formatDay(story.priciestDay.date))}
              </p>
              <p className="text-lg text-white/80">
                {money(story.priciestDay.amount)} in{" "}
                {story.priciestDay.count === 1 ? "una spesa" : `${story.priciestDay.count} spese`}.
              </p>
            </div>
          </div>
        ),
      });
    }

    list.push({
      id: "no-spend",
      content: (
        <div className="grid gap-5">
          <CalendarX2 className="size-14" aria-hidden />
          <Big className="text-7xl sm:text-8xl">{story.noSpendDays}</Big>
          <p className="text-3xl font-semibold">
            {story.noSpendDays === 1 ? "giorno" : "giorni"} senza spendere un euro
          </p>
          {story.longestStreak >= 2 && (
            <p className="text-lg text-white/80">
              La serie più lunga: {story.longestStreak} giorni di fila.
            </p>
          )}
        </div>
      ),
    });

    if (story.previous?.change != null) {
      const change = story.previous.change;
      list.push({
        id: "compare",
        content: (
          <div className="grid gap-5">
            <Kicker>Rispetto a {previousMonthName}</Kicker>
            <Big className="text-7xl">
              {change > 0 ? "+" : "−"}
              {pct(Math.abs(change))}
            </Big>
            <p className="text-2xl font-semibold">
              {Math.abs(change) < 3
                ? "di spese: praticamente uguale"
                : `di spese ${change > 0 ? "in più" : "in meno"}`}
            </p>
            {story.mover && (
              <p className="text-lg text-white/80">
                A cambiare di più: {story.mover.name}, {story.mover.delta > 0 ? "+" : "−"}
                {whole(Math.abs(story.mover.delta))}.
              </p>
            )}
          </div>
        ),
      });
    }

    list.push({
      id: "archetype",
      content: (
        <div className="grid justify-items-center gap-5 text-center">
          <Kicker>Il tuo profilo del mese</Kicker>
          <span className="flex size-28 items-center justify-center rounded-full bg-white text-[#7c3aed] shadow-2xl motion-safe:animate-[pop_0.7s_ease-out_both]">
            <ArchetypeIcon className="size-14" aria-hidden />
          </span>
          <Big className="text-4xl sm:text-5xl">{story.archetype.name}</Big>
          <p className="max-w-xs text-lg text-white/85">{story.archetype.description}</p>
        </div>
      ),
    });

    list.push({ id: "outro", content: null });
    return list;
  }, [
    story,
    monthName,
    previousMonthName,
    year,
    page.isCurrent,
    money,
    whole,
    workTime,
    top,
    ArchetypeIcon,
  ]);

  const last = slides.length - 1;
  const close = useCallback(() => router.push("/dashboard"), [router]);
  const next = useCallback(() => setIndex((i) => Math.min(last, i + 1)), [last]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") close();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [next, prev, close]);

  async function share() {
    setSharing(true);
    try {
      const blob = await renderStoryCard(story, monthName, year);
      const file = new File([blob], `fintrack-${story.month}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Il mio ${monthName} su FinTrack` });
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

  const slide = slides[index];
  const isOutro = slide.id === "outro";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Il tuo ${monthName} in storie`}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden text-white sm:h-[min(92svh,860px)] sm:w-[min(92vw,480px)] sm:rounded-3xl"
        style={{ background: GRADIENTS[index % GRADIENTS.length], transition: "background 600ms" }}
      >
        <div className="flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {slides.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                key={`${s.id}-${index}`}
                className="h-full bg-white"
                style={
                  i < index
                    ? { width: "100%" }
                    : i === index && i !== last
                      ? {
                          width: "100%",
                          transformOrigin: "left",
                          animation: `story-progress ${SLIDE_MS}ms linear both`,
                          animationPlayState: paused ? "paused" : "running",
                        }
                      : { width: i === index ? "100%" : "0%" }
                }
                onAnimationEnd={i === index ? next : undefined}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 pt-3">
          <p className="text-sm font-medium text-white/80">
            FinTrack · {capitalize(monthName)} {year}
          </p>
          <button
            type="button"
            onClick={close}
            aria-label="Chiudi le storie"
            className="rounded-full p-1.5 hover:bg-white/15"
          >
            <X className="size-5" />
          </button>
        </div>

        {isOutro ? (
          <div className="flex flex-1 flex-col justify-center gap-6 px-7 pb-8">
            <div className="grid justify-items-center gap-2 text-center">
              <Trophy className="size-10" aria-hidden />
              <p className="text-3xl font-bold">{capitalize(monthName)}, fatto.</p>
              <p className="text-white/80">{story.archetype.name}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-center">
              {[
                { label: "Uscite", value: money(story.expense) },
                {
                  label: "Risparmio",
                  value: story.savingsRate !== null ? pct(story.savingsRate) : "—",
                },
                { label: "Giorni senza spese", value: String(story.noSpendDays) },
                { label: "Top categoria", value: top?.name ?? "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white/12 p-3">
                  <dt className="text-xs text-white/70">{item.label}</dt>
                  <dd className="truncate text-lg font-semibold tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={share}
                disabled={sharing}
                className="flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 font-semibold text-[#4338ca] disabled:opacity-70"
              >
                {typeof navigator !== "undefined" && "share" in navigator ? (
                  <Share2 className="size-4" />
                ) : (
                  <Download className="size-4" />
                )}
                {sharing ? "Preparo l'immagine…" : "Condividi il tuo mese"}
              </button>
              <p className="text-center text-xs text-white/70">
                L&apos;immagine non contiene importi: solo percentuali e il tuo profilo.
              </p>
              <button
                type="button"
                onClick={() => setIndex(0)}
                className="flex items-center justify-center gap-2 rounded-full px-4 py-2.5 font-medium hover:bg-white/10"
              >
                <RotateCcw className="size-4" /> Rivedi
              </button>
            </div>
            <div className="flex justify-between text-sm">
              {page.prev ? (
                <Link
                  href={`/stories?month=${page.prev}`}
                  className="flex items-center gap-1 hover:underline"
                >
                  <ChevronLeft className="size-4" /> Mese prima
                </Link>
              ) : (
                <span />
              )}
              {page.next && (
                <Link
                  href={`/stories?month=${page.next}`}
                  className="flex items-center gap-1 hover:underline"
                >
                  Mese dopo <ChevronRight className="size-4" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div
            className="relative flex flex-1 cursor-pointer items-center px-7 pb-16 select-none"
            onPointerDown={() => {
              held.current = false;
              holdTimer.current = window.setTimeout(() => {
                held.current = true;
                setPaused(true);
              }, 220);
            }}
            onPointerUp={(e) => {
              if (holdTimer.current) window.clearTimeout(holdTimer.current);
              if (held.current) {
                setPaused(false);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              if (e.clientX - rect.left < rect.width / 3) prev();
              else next();
            }}
            onPointerLeave={() => {
              if (holdTimer.current) window.clearTimeout(holdTimer.current);
              if (held.current) setPaused(false);
            }}
          >
            <div
              key={slide.id}
              className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-6 w-full motion-safe:duration-700"
            >
              {slide.content}
            </div>
            <p className="absolute inset-x-0 bottom-5 text-center text-xs text-white/60">
              {paused ? "In pausa" : "Tocca a destra per andare avanti, tieni premuto per fermare"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
