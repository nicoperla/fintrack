"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Crown,
  MessageCircle,
  PartyPopper,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useMoney, useWholeMoney } from "@/components/currency-provider";
import { DecisionForm } from "@/components/money-talk/decision-form";
import { DecisionItem } from "@/components/money-talk/decision-item";
import {
  formatMonthYear,
  suggestionLink,
  suggestionText,
  toWord,
  winText,
} from "@/components/money-talk/words";
import { markTalkHeld } from "@/app/(dashboard)/caffe/actions";
import { CATEGORY_ICONS, type CategoryIconName } from "@/lib/category-style";
import { TALK_STEPS, type TalkStep } from "@/lib/finance/money-talk";
import type { MoneyTalkPage } from "@/lib/data/money-talk";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

export const STEP_TITLES: Record<TalkStep, string> = {
  month: "Com'è andato il mese",
  contributions: "Chi ha messo cosa",
  goals: "Gli obiettivi",
  decision: "Una decisione",
  win: "Una cosa da festeggiare",
};

// Dark enough everywhere for white text, light or dark theme.
const GRADIENTS: Record<TalkStep, string> = {
  month: "linear-gradient(160deg, #431407, #9a3412 55%, #b45309)",
  contributions: "linear-gradient(160deg, #1e3a8a, #3730a3 55%, #6d28d9)",
  goals: "linear-gradient(160deg, #064e3b, #047857 55%, #0e7490)",
  decision: "linear-gradient(160deg, #3b0764, #6d28d9 55%, #be185d)",
  win: "linear-gradient(160deg, #881337, #be123c 55%, #c2410c)",
};

const PROMPTS: Record<TalkStep, string[]> = {
  month: ["Cosa vi ha sorpreso?", "Una spesa che rifareste, e una che no?"],
  contributions: [
    "La vostra regola vi sembra ancora giusta?",
    "C'è qualcosa da pareggiare prima di andare avanti?",
  ],
  goals: ["È ancora l'obiettivo giusto?", "Quanto ci mettete questo mese?"],
  decision: ["Una sola, piccola e concreta.", "Con un nome accanto, o «insieme»."],
  win: ["Come festeggiate? Anche un caffè vero va bene."],
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const failed = (): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." });

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium tracking-wide text-white/75 uppercase">{children}</p>;
}

function Big({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-4xl leading-none font-bold tracking-tight tabular-nums sm:text-5xl",
        className,
      )}
    >
      {children}
    </p>
  );
}

function Bar({ value, marker }: { value: number; marker?: number }) {
  return (
    <div className="relative h-2.5 rounded-full bg-white/20">
      <div
        className="h-full origin-left rounded-full bg-white motion-safe:animate-[grow_0.9s_ease-out_both]"
        style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }}
      />
      {marker !== undefined && (
        <span
          aria-hidden
          className="absolute -top-1 h-4.5 w-0.5 rounded-full bg-white/90 ring-2 ring-black/20"
          style={{ left: `calc(${Math.min(1, Math.max(0, marker)) * 100}% - 1px)` }}
        />
      )}
    </div>
  );
}

function Glyph({ icon, className }: { icon: string | null; className?: string }) {
  const Icon: LucideIcon = (icon && CATEGORY_ICONS[icon as CategoryIconName]) || Crown;
  return <Icon className={className} aria-hidden />;
}

/** The five steps of the talk, one at a time, with the decision form at step four. */
export function TalkSlides({
  data,
  step,
  onStep,
  onClose,
}: {
  data: MoneyTalkPage;
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
}) {
  const money = useMoney();
  const whole = useWholeMoney();
  const [pending, start] = useTransition();
  const [finished, setFinished] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const { talk } = data;
  const key = TALK_STEPS[step];
  const last = TALK_STEPS.length - 1;
  const months = { previous: data.previousMonthName };
  const f = { money, whole };

  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, finished]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight" && step < last) onStep(step + 1);
      else if (e.key === "ArrowLeft" && step > 0) onStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, last, onStep]);

  const finish = () =>
    start(async () => {
      const res = await markTalkHeld(data.month).catch(failed);
      if (res.ok) setFinished(true);
      else toast.error(res.error ?? "Salvataggio non riuscito. Riprova.");
    });

  const taken = data.decisions.filter((d) => d.month === data.month);

  if (finished) {
    return (
      <section
        ref={panelRef}
        aria-labelledby="talk-step-title"
        className="grid scroll-mt-20 gap-6 overflow-hidden rounded-3xl p-6 text-white shadow-xl sm:p-8"
        style={{ background: GRADIENTS.month }}
      >
        <div className="grid justify-items-center gap-3 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-white text-amber-800 motion-safe:animate-[pop_0.6s_ease-out_both]">
            <Coffee className="size-8" aria-hidden />
          </span>
          <h2
            id="talk-step-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl font-bold outline-none"
          >
            Caffè fatto.
          </h2>
          <p className="max-w-sm text-white/85">
            {data.nextTalk
              ? `Il prossimo a inizio ${data.nextTalk}, sui numeri di ${data.nextMonthName}: ve lo ricordo io.`
              : `Il caffè di ${data.monthName} è nel vostro registro.`}
          </p>
        </div>
        {taken.length > 0 && (
          <div className="grid gap-3 rounded-2xl bg-white/12 p-4">
            <p className="text-sm font-medium text-white/80">
              {taken.length === 1 ? "La decisione di oggi" : "Le decisioni di oggi"}
            </p>
            <ul className="grid gap-3">
              {taken.map((d) => (
                <DecisionItem key={d.id} decision={d} today={data.today} tone="panel" />
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="justify-self-center rounded-full bg-white px-6 py-2.5 font-semibold text-amber-900"
        >
          Chiudi
        </button>
      </section>
    );
  }

  let content: ReactNode;
  switch (key) {
    case "month": {
      const o = talk.overview;
      content =
        o.shared > 0 ? (
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Big>{money(o.shared)}</Big>
              <p className="text-lg text-white/85">
                di spese comuni a {data.monthName}
                {o.change !== null &&
                  (Math.abs(o.change) < 3
                    ? `, come ${toWord(data.previousMonthName)}`
                    : `, ${o.change > 0 ? "+" : "−"}${Math.round(Math.abs(o.change))}% rispetto ${toWord(data.previousMonthName)}`)}
                .
              </p>
            </div>
            <ol className="grid gap-4">
              {o.categories.map((c) => (
                <li key={c.id} className="grid gap-1.5">
                  <div className="flex items-center gap-3">
                    <Glyph icon={c.icon} className="size-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                    <span className="tabular-nums">{money(c.amount)}</span>
                  </div>
                  <div className="ml-8">
                    <Bar value={c.share} />
                  </div>
                </li>
              ))}
            </ol>
            {o.mover && (
              <p className="text-white/85">
                A cambiare di più: <strong>{o.mover.name}</strong>, {o.mover.delta > 0 ? "+" : "−"}
                {money(Math.abs(o.mover.delta))} rispetto {toWord(data.previousMonthName)}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-2xl font-semibold">
            A {data.monthName} non avete registrato spese comuni.
          </p>
        );
      break;
    }
    case "contributions": {
      const c = talk.contributions;
      const total = c.members.reduce((s, m) => s + m.paid, 0);
      const rule =
        c.mode === "INCOME"
          ? "in proporzione alle entrate"
          : c.members.length === 2
            ? "a metà"
            : "in parti uguali";
      content = (
        <div className="grid gap-6">
          {total > 0 ? (
            <ul className="grid gap-5">
              {c.members.map((m) => (
                <li key={m.userId} className="grid gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xl font-semibold">{m.name}</span>
                    <span className="text-right tabular-nums">
                      <span className="text-xl font-bold">{pct(m.paidShare)}</span>{" "}
                      <span className="text-white/75">· {money(m.paid)}</span>
                    </span>
                  </div>
                  <Bar value={m.paidShare} marker={m.due} />
                  <p className="text-xs text-white/70">Secondo la regola: {pct(m.due)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-2xl font-semibold">
              A {data.monthName} nessuno ha registrato spese comuni.
            </p>
          )}
          <div className="grid gap-1 text-white/85">
            <p>
              La vostra regola: <strong>{rule}</strong>.
              {c.fallback &&
                " Avete scelto in proporzione alle entrate, ma manca quella di qualcuno: per ora conto in parti uguali."}
            </p>
            {c.unattributed > 0 && (
              <p className="text-sm text-white/70">
                Più {money(c.unattributed)} registrati da chi non è più nello spazio.
              </p>
            )}
          </div>
          <div className="grid gap-2 rounded-2xl bg-white/12 p-4">
            {talk.transfers.length === 0 ? (
              <p className="font-medium">Oggi siete pari: nessuno deve niente a nessuno.</p>
            ) : (
              talk.transfers.map((t) => (
                <p key={`${t.from}-${t.to}`} className="font-medium">
                  Per essere pari oggi: {t.from} dà {money(t.amount)} {toWord(t.to)}.
                </p>
              ))
            )}
            <Link
              href="/split"
              className="inline-flex items-center gap-1 text-sm text-white/85 underline-offset-2 hover:underline"
            >
              Apri Conti chiari <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      );
      break;
    }
    case "goals": {
      const byIncome = talk.contributions.mode === "INCOME";
      const goalPace = (g: (typeof talk.goals)[number]) => {
        if (g.overdue) return "La data che avevate scelto è passata.";
        if (g.monthly === null || !g.targetDate) return "Senza data: il ritmo lo decidete voi.";
        const pace = `Per arrivarci entro ${formatMonthYear(g.targetDate)}: ${whole(Math.ceil(g.monthly))} al mese`;
        if (g.perMember.length === 0) return `${pace}.`;
        return byIncome
          ? `${pace} (${g.perMember.map((m) => `${m.name} ${whole(m.amount)}`).join(", ")}, in base alle entrate).`
          : `${pace}, ${whole(g.perMember[0].amount)} a testa.`;
      };
      content =
        talk.goals.length > 0 ? (
          <div className="grid gap-5">
            <ul className="grid gap-5">
              {talk.goals.map((g) => (
                <li key={g.id} className="grid gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-lg font-semibold">
                      <Glyph icon={g.icon} className="size-5 shrink-0" />
                      <span className="truncate">{g.name}</span>
                    </span>
                    <span className="font-bold tabular-nums">{pct(g.progress)}</span>
                  </div>
                  <Bar value={g.progress} />
                  <p className="text-sm text-white/80 tabular-nums">
                    {whole(g.current)} di {whole(g.target)}. {goalPace(g)}
                  </p>
                </li>
              ))}
            </ul>
            {talk.goalCount > talk.goals.length && (
              <Link href="/goals" className="text-sm text-white/85 underline underline-offset-2">
                E{" "}
                {talk.goalCount - talk.goals.length === 1
                  ? "un altro"
                  : `altri ${talk.goalCount - talk.goals.length}`}{" "}
                negli obiettivi
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-2xl font-semibold">Non avete ancora un obiettivo comune.</p>
            <p className="text-white/85">
              Le vacanze, un fondo per gli imprevisti, la caparra di casa: con una data, FinTrack vi
              dice quanto mettere al mese, e chi quanto.
            </p>
            <Link
              href="/goals"
              className="inline-flex items-center gap-1 justify-self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-900"
            >
              Crea un obiettivo <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        );
      break;
    }
    case "decision": {
      // Decisions to look back on: those of the last talk, and older ones still open.
      const review = data.decisions.filter(
        (d) => d.month < data.month && (d.fromLastTalk || !d.done),
      );
      content = (
        <div className="grid gap-6">
          {review.length > 0 && (
            <div className="grid gap-3 rounded-2xl bg-white/12 p-4">
              <p className="text-sm font-medium text-white/85">
                Prima, l&apos;ultima volta: fatte o ancora da fare?
              </p>
              <ul className="grid gap-3">
                {review.slice(0, 6).map((d) => (
                  <DecisionItem key={d.id} decision={d} today={data.today} tone="panel" showMonth />
                ))}
              </ul>
            </div>
          )}
          <DecisionForm
            month={data.month}
            suggestions={talk.suggestions.map((s) => ({
              suggestion: s,
              text: suggestionText(s, f, months),
              link: suggestionLink(s),
            }))}
            members={data.members}
            today={data.today}
          />
          {taken.length > 0 && (
            <div className="grid gap-3">
              <p className="text-sm font-medium text-white/85">
                {data.held ? `Decise al caffè di ${data.monthName}` : "Decise oggi"}
              </p>
              <ul className="grid gap-3">
                {taken.map((d) => (
                  <DecisionItem key={d.id} decision={d} today={data.today} tone="panel" />
                ))}
              </ul>
            </div>
          )}
        </div>
      );
      break;
    }
    case "win": {
      const [first, ...others] = talk.wins.map((w) => winText(w, f, months));
      content = (
        <div className="grid gap-6">
          <span className="flex size-16 items-center justify-center rounded-full bg-white text-rose-700 motion-safe:animate-[pop_0.6s_ease-out_both]">
            <PartyPopper className="size-8" aria-hidden />
          </span>
          <div className="grid gap-2">
            <p className="text-3xl leading-tight font-bold">{first.title}</p>
            {first.detail && <p className="text-lg text-white/85">{first.detail}</p>}
          </div>
          {others.length > 0 && (
            <ul className="grid gap-2 border-t border-white/20 pt-4">
              {others.map((w) => (
                <li key={w.title} className="text-white/90">
                  E poi: {w.title.charAt(0).toLowerCase() + w.title.slice(1)}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
      break;
    }
  }

  return (
    <section
      ref={panelRef}
      aria-labelledby="talk-step-title"
      className="grid scroll-mt-20 overflow-hidden rounded-3xl text-white shadow-xl"
      style={{ background: GRADIENTS[key], transition: "background 500ms" }}
    >
      <div className="flex gap-1.5 px-5 pt-5 sm:px-8">
        {TALK_STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => onStep(i)}
            aria-label={`Passo ${i + 1}: ${STEP_TITLES[s]}`}
            aria-current={i === step ? "step" : undefined}
            className="group flex-1 py-1.5"
          >
            <span
              className={cn(
                "block h-1.5 rounded-full transition-colors",
                i <= step ? "bg-white" : "bg-white/30 group-hover:bg-white/50",
              )}
            />
          </button>
        ))}
      </div>
      <div className="flex items-start justify-between gap-3 px-5 pt-3 sm:px-8">
        <div className="grid gap-1">
          <Kicker>
            {step + 1} di {TALK_STEPS.length} · il caffè di {data.monthName}
          </Kicker>
          <h2
            id="talk-step-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight outline-none sm:text-3xl"
          >
            {key === "month" ? `Com'è andato ${data.monthName}` : STEP_TITLES[key]}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi il caffè dei conti"
          className="rounded-full p-1.5 hover:bg-white/15"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div
        key={key}
        className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 grid gap-6 px-5 pt-6 pb-6 motion-safe:duration-500 sm:px-8"
      >
        {content}
        <div className="grid gap-1.5 rounded-2xl border border-white/20 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-white/80">
            <MessageCircle className="size-4" aria-hidden /> Di cosa parlare
          </p>
          <ul className="grid gap-1 text-white/95">
            {PROMPTS[key].map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/15 px-5 py-4 sm:px-8">
        <button
          type="button"
          onClick={() => onStep(step - 1)}
          disabled={step === 0}
          className="flex items-center gap-1 rounded-full px-3 py-2 font-medium hover:bg-white/10 disabled:invisible"
        >
          <ChevronLeft className="size-4" aria-hidden /> Indietro
        </button>
        {step < last ? (
          <button
            type="button"
            onClick={() => onStep(step + 1)}
            className="flex items-center gap-1 rounded-full bg-white px-5 py-2.5 font-semibold text-neutral-900"
          >
            {STEP_TITLES[TALK_STEPS[step + 1]]} <ChevronRight className="size-4" aria-hidden />
          </button>
        ) : data.held ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-5 py-2.5 font-semibold text-neutral-900"
          >
            Chiudi
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            disabled={pending}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-neutral-900 disabled:opacity-70"
          >
            <Coffee className="size-4" aria-hidden />
            {pending ? "Un attimo…" : "Caffè fatto"}
          </button>
        )}
      </div>
    </section>
  );
}
