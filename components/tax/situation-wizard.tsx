"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoiceCard, Stepper, useAction } from "@/components/tax/ui";
import { saveSituation } from "@/app/(dashboard)/730/actions";
import {
  HOMES,
  HOME_LABELS,
  LIFE_EVENTS,
  LIFE_EVENT_LABELS,
  OTHER_INCOMES,
  OTHER_INCOME_LABELS,
  WORK_KINDS,
  WORK_LABELS,
  type Situation,
} from "@/lib/tax/situation";

type Step = "work" | "agent" | "home" | "family" | "income" | "events";

const TITLES: Record<Step, (year: number) => string> = {
  work: (y) => `Nel ${y} che lavoro hai fatto?`,
  agent: (y) => `A luglio ${y + 1} qualcuno ti pagherà uno stipendio o la pensione?`,
  home: () => "Dove vivi?",
  family: () => "Chi è a carico tuo?",
  income: (y) => `Nel ${y} hai avuto altre entrate?`,
  events: (y) => `Nel ${y} è successo qualcosa di questo?`,
};

const WHY: Record<Step, string> = {
  work: "Decide chi ha già fatto i conti delle tue tasse e quale modello usare.",
  agent: "È lui che a luglio ti dà il rimborso in busta paga o trattiene il debito.",
  home: "Mutuo e affitto valgono una detrazione; quella per l'affitto di solito manca nel precompilato.",
  family:
    "Per i figli sotto i 21 anni c'è l'Assegno unico: qui contano quelli da 21 a 30 anni (o con disabilità).",
  income: "Queste entrate vanno dichiarate: se ci sono, il 730 si fa per forza.",
  events: "Sono le cose che cambiano di più il 730: ti dico cosa controllare.",
};

const HINTS: Partial<Record<string, string>> = {
  none: "Senza lavoro a fine anno, studi, ti occupi della casa…",
  "rent-income": "Anche con la cedolare secca.",
  occasional: "Con la ritenuta del 20%, senza partita IVA.",
  vat: "Il 730 non si può usare: ti dico cosa preparare.",
  renovation: "Ristrutturazione, risparmio energetico, mobili per la casa ristrutturata.",
  death: "Eredità, immobili ricevuti, il 730 della persona scomparsa.",
};

/** "Chi sei": six questions, one at a time. */
export function SituationWizard({
  year,
  initial,
  onDone,
}: {
  year: number;
  initial: Situation;
  onDone?: () => void;
}) {
  const [s, setS] = useState<Situation>(initial);
  const [index, setIndex] = useState(0);
  const { pending, run } = useAction();
  const steps: Step[] = (["work", "agent", "home", "family", "income", "events"] as Step[]).filter(
    (step) => step !== "agent" || s.work !== "none",
  );
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const set = (patch: Partial<Situation>) => setS((prev) => ({ ...prev, ...patch }));
  const toggle = <T extends string>(list: T[], item: T, on: boolean) =>
    on ? [...list.filter((i) => i !== item), item] : list.filter((i) => i !== item);

  const ready =
    (step === "work" && s.work !== null) ||
    (step === "agent" && s.agent !== null) ||
    (step === "home" && s.home !== null) ||
    step === "family" ||
    step === "income" ||
    step === "events";

  function save() {
    run(
      () =>
        saveSituation(year, {
          work: s.work,
          moreEmployers: s.work === "none" ? false : s.moreEmployers,
          agent: s.work === "none" ? false : s.agent,
          home: s.home,
          spouse: s.spouse,
          children: s.children,
          childrenShare: s.childrenShare,
          parents: s.parents,
          childIncomeRisk: s.childIncomeRisk,
          otherIncome: s.otherIncome,
          events: s.events,
        }),
      "Fatto: ecco il tuo caso",
      onDone,
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <div
          className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-label="Domande"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-300"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">
          {index + 1} di {steps.length}
        </span>
      </div>

      <div key={step} className="animate-in fade-in slide-in-from-right-2 grid gap-3 duration-300">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{TITLES[step](year)}</h3>
          <p className="text-muted-foreground text-sm">{WHY[step]}</p>
        </div>

        {step === "work" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {WORK_KINDS.map((w) => (
              <ChoiceCard
                key={w}
                type="radio"
                name="work"
                checked={s.work === w}
                onChange={() => set({ work: w })}
                label={WORK_LABELS[w]}
                hint={HINTS[w]}
              />
            ))}
            {s.work && s.work !== "none" && (
              <div className="sm:col-span-2">
                <ChoiceCard
                  type="checkbox"
                  name="moreEmployers"
                  checked={s.moreEmployers}
                  onChange={(on) => set({ moreEmployers: on })}
                  label="Ho avuto più di un datore di lavoro (o più pensioni)"
                  hint="Hai cambiato lavoro, o hai fatto due lavori: avrai più di una CU."
                />
              </div>
            )}
          </div>
        )}

        {step === "agent" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard
              type="radio"
              name="agent"
              checked={s.agent === true}
              onChange={() => set({ agent: true })}
              label="Sì"
              hint="Il rimborso arriva in busta paga o nella pensione."
            />
            <ChoiceCard
              type="radio"
              name="agent"
              checked={s.agent === false}
              onChange={() => set({ agent: false })}
              label="No"
              hint="Il rimborso te lo paga l'Agenzia sul conto."
            />
          </div>
        )}

        {step === "home" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {HOMES.map((h) => (
              <ChoiceCard
                key={h}
                type="radio"
                name="home"
                checked={s.home === h}
                onChange={() => set({ home: h })}
                label={HOME_LABELS[h]}
              />
            ))}
          </div>
        )}

        {step === "family" && (
          <div className="grid gap-3">
            <ChoiceCard
              type="checkbox"
              name="spouse"
              checked={s.spouse}
              onChange={(on) => set({ spouse: on })}
              label="Il coniuge"
              hint="Se nell'anno ha guadagnato al massimo 2.840,51 €."
            />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <span>
                <span className="font-medium">Figli da 21 a 30 anni</span>
                <span className="text-muted-foreground block text-xs">
                  O con disabilità, di ogni età dai 21 anni. Con reddito fino a 4.000 € (sotto i 24
                  anni) o 2.840,51 €.
                </span>
              </span>
              <Stepper
                value={s.children}
                onChange={(children) => set({ children })}
                max={10}
                label="Figli a carico"
              />
            </div>
            {s.children > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                <ChoiceCard
                  type="radio"
                  name="share"
                  checked={s.childrenShare === 50}
                  onChange={() => set({ childrenShare: 50 })}
                  label="Divisi a metà con l'altro genitore"
                />
                <ChoiceCard
                  type="radio"
                  name="share"
                  checked={s.childrenShare === 100}
                  onChange={() => set({ childrenShare: 100 })}
                  label="Tutti a carico mio"
                  hint="Per esempio se l'altro genitore non c'è o guadagna poco."
                />
                <div className="sm:col-span-2">
                  <ChoiceCard
                    type="checkbox"
                    name="childIncomeRisk"
                    checked={s.childIncomeRisk}
                    onChange={(on) => set({ childIncomeRisk: on })}
                    label="Un figlio sta guadagnando qualcosa (tirocinio, lavoro estivo)"
                    hint="Ti avviso quando si avvicina al limite."
                  />
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <span>
                <span className="font-medium">Genitori che vivono con te</span>
                <span className="text-muted-foreground block text-xs">
                  Con reddito fino a 2.840,51 €.
                </span>
              </span>
              <Stepper
                value={s.parents}
                onChange={(parents) => set({ parents })}
                max={4}
                label="Genitori a carico"
              />
            </div>
          </div>
        )}

        {step === "income" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {OTHER_INCOMES.map((i) => (
              <ChoiceCard
                key={i}
                type="checkbox"
                name="otherIncome"
                checked={s.otherIncome.includes(i)}
                onChange={(on) => set({ otherIncome: toggle(s.otherIncome, i, on) })}
                label={OTHER_INCOME_LABELS[i]}
                hint={HINTS[i]}
              />
            ))}
            <ChoiceCard
              type="checkbox"
              name="noIncome"
              checked={s.otherIncome.length === 0}
              onChange={() => set({ otherIncome: [] })}
              label="Nessuna di queste"
            />
          </div>
        )}

        {step === "events" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {LIFE_EVENTS.map((e) => (
              <ChoiceCard
                key={e}
                type="checkbox"
                name="events"
                checked={s.events.includes(e)}
                onChange={(on) => set({ events: toggle(s.events, e, on) })}
                label={LIFE_EVENT_LABELS[e]}
                hint={HINTS[e]}
              />
            ))}
            <ChoiceCard
              type="checkbox"
              name="noEvents"
              checked={s.events.length === 0}
              onChange={() => set({ events: [] })}
              label="Niente di tutto questo"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0 || pending}
        >
          <ArrowLeft /> Indietro
        </Button>
        {last ? (
          <Button type="button" onClick={save} disabled={!ready || pending}>
            <Check /> {pending ? "Salvo…" : "Fatto"}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
            disabled={!ready}
          >
            Avanti <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}
