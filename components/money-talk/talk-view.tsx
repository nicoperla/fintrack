"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Coffee, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { DecisionItem } from "@/components/money-talk/decision-item";
import { STEP_TITLES, TalkSlides } from "@/components/money-talk/talk-slides";
import { toWord } from "@/components/money-talk/words";
import { onDate } from "@/components/true-salary/format";
import { undoTalk } from "@/app/(dashboard)/caffe/actions";
import { TALK_STEPS, type TalkStep } from "@/lib/finance/money-talk";
import type { MoneyTalkPage } from "@/lib/data/money-talk";
import type { ActionResult } from "@/lib/action-result";

const failed = (): ActionResult => ({ ok: false, error: "Operazione non riuscita. Riprova." });

export function TalkView({ data }: { data: MoneyTalkPage }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  return (
    <div className="grid grid-cols-1 gap-8">
      {open ? (
        <TalkSlides data={data} step={step} onStep={setStep} onClose={() => setOpen(false)} />
      ) : (
        <Cover
          data={data}
          onStart={() => {
            setStep(0);
            setOpen(true);
          }}
        />
      )}
      <DecisionLog data={data} />
    </div>
  );
}

/** What each step will be about, from the numbers: the agenda before sitting down. */
function useAgenda(data: MoneyTalkPage): Record<TalkStep, string> {
  const money = useMoney();
  const { overview, contributions, goalCount } = data.talk;
  const change =
    overview.change === null || Math.abs(overview.change) < 3
      ? ""
      : `, ${overview.change > 0 ? "+" : "−"}${Math.round(Math.abs(overview.change))}% rispetto ${toWord(data.previousMonthName)}`;
  const open = data.decisions.filter((d) => d.month < data.month && !d.done).length;
  return {
    month:
      overview.shared > 0
        ? `${money(overview.shared)} di spese comuni${change}`
        : "Nessuna spesa comune registrata",
    contributions:
      overview.shared > 0
        ? contributions.members
            .map((m) => `${m.name} ${Math.round(m.paidShare * 100)}%`)
            .join(" · ")
        : "Niente da dividere, questa volta",
    goals:
      goalCount === 0
        ? "Nessun obiettivo comune, per ora"
        : goalCount === 1
          ? "Un obiettivo aperto"
          : `${goalCount} obiettivi aperti`,
    decision:
      open > 0
        ? `Prima, ${open === 1 ? "quella ancora aperta" : `le ${open} ancora aperte`}; poi si parte da: ${data.talk.suggestions[0].topic}`
        : `Si parte da: ${data.talk.suggestions[0].topic}`,
    win: "C'è, ma ve la dico alla fine",
  };
}

function Cover({ data, onStart }: { data: MoneyTalkPage; onStart: () => void }) {
  const agenda = useAgenda(data);
  const [pending, start] = useTransition();
  const nth = data.talksHeld + (data.held ? 0 : 1);

  const undo = () =>
    start(async () => {
      const res = await undoTalk(data.month).catch(failed);
      if (res.ok) toast.success("Fatto: il caffè è di nuovo da fare");
      else toast.error(res.error ?? "Operazione non riuscita. Riprova.");
    });

  return (
    <section
      aria-labelledby="talk-cover-title"
      className="grid gap-6 overflow-hidden rounded-3xl p-6 text-white shadow-xl sm:p-8"
      style={{ background: "linear-gradient(160deg, #431407, #9a3412 55%, #b45309)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/80">
        <span>
          {nth > 1 && !data.held ? `Il vostro ${nth}° caffè dei conti` : "Il caffè dei conti"}
        </span>
        <nav aria-label="Altri mesi" className="flex items-center gap-1">
          {data.prev && (
            <Link
              href={`/caffe?month=${data.prev}`}
              className="flex items-center gap-0.5 rounded-full px-2 py-1 hover:bg-white/10"
            >
              <ChevronLeft className="size-4" aria-hidden /> {data.previousMonthName}
            </Link>
          )}
          {data.next && (
            <Link
              href={`/caffe?month=${data.next}`}
              className="flex items-center gap-0.5 rounded-full px-2 py-1 hover:bg-white/10"
            >
              {data.nextMonthName} <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </nav>
      </div>

      <div className="flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <Coffee className="size-7" aria-hidden />
        </span>
        <div className="grid gap-1">
          <h2 id="talk-cover-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {data.held
              ? `Il caffè di ${data.monthName}: fatto`
              : `Il caffè di ${data.monthName} è pronto`}
          </h2>
          <p className="text-white/85">
            {data.held
              ? `L'avete fatto ${onDate(data.held.on)}${data.held.by ? `: l'ha segnato ${data.held.by}` : ""}. Potete rivederlo quando volete.`
              : "Sedetevi insieme, un quarto d'ora, un punto alla volta. L'agenda l'ho già scritta io con i vostri numeri."}
          </p>
        </div>
      </div>

      <ol className="grid gap-3">
        {TALK_STEPS.map((s, i) => (
          <li key={s} className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
              {i + 1}
            </span>
            <span className="grid">
              <span className="font-semibold">
                {s === "month" ? `Com'è andato ${data.monthName}` : STEP_TITLES[s]}
              </span>
              <span className="text-sm text-white/75">{agenda[s]}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          className="rounded-full bg-white px-6 py-3 font-semibold text-amber-900"
        >
          {data.held ? "Rivedi" : "Iniziamo"}
        </button>
        {data.held && (
          <button
            type="button"
            onClick={undo}
            disabled={pending}
            className="rounded-full px-3 py-2 text-sm text-white/80 underline-offset-2 hover:underline disabled:opacity-60"
          >
            Non l&apos;avete fatto? Segnalo da fare
          </button>
        )}
      </div>
    </section>
  );
}

function DecisionLog({ data }: { data: MoneyTalkPage }) {
  const open = data.decisions.filter((d) => !d.done);
  const done = data.decisions.filter((d) => d.done);

  return (
    <section aria-labelledby="decisions-title" className="grid grid-cols-1 gap-4">
      <div>
        <h2 id="decisions-title" className="flex items-center gap-2 text-lg font-semibold">
          <ListChecks className="size-5" aria-hidden /> Le vostre decisioni
        </h2>
        <p className="text-muted-foreground text-sm">
          Quello che decidete al caffè resta qui, con chi se ne occupa: lo spuntate quando è fatto,
          anche da due telefoni diversi.
        </p>
      </div>
      {data.decisions.length === 0 ? (
        <p className="bg-card/50 text-muted-foreground rounded-2xl border border-dashed p-5 text-sm">
          Ancora nessuna decisione. Al quarto passo del caffè ne scrivete una: piccola, concreta,
          con un nome accanto.
        </p>
      ) : (
        <div className="bg-card grid gap-5 rounded-2xl border p-5">
          {open.length > 0 ? (
            <ul className="grid gap-4">
              {open.map((d) => (
                <DecisionItem
                  key={d.id}
                  decision={d}
                  today={data.today}
                  tone="page"
                  showMonth
                  canDelete
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Tutto quello che avete deciso è fatto.
            </p>
          )}
          {done.length > 0 && (
            <details className="group border-t pt-4">
              <summary className="text-muted-foreground cursor-pointer text-sm font-medium">
                {done.length === 1 ? "1 fatta" : `${done.length} fatte`}
              </summary>
              <ul className="mt-4 grid gap-4">
                {done.map((d) => (
                  <DecisionItem
                    key={d.id}
                    decision={d}
                    today={data.today}
                    tone="page"
                    showMonth
                    canDelete
                  />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
