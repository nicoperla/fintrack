"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Info,
  KeyRound,
  MailOpen,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentsCard } from "@/components/tax/documents-card";
import { EstimateCard } from "@/components/tax/estimate-card";
import { FolderCard } from "@/components/tax/folder-card";
import { SituationWizard } from "@/components/tax/situation-wizard";
import { PrecompiledCard } from "@/components/tax/precompiled-card";
import { SendCard } from "@/components/tax/send-card";
import { AfterCard } from "@/components/tax/after-card";
import { CoupleCard } from "@/components/tax/couple-card";
import { HomeBonusCard } from "@/components/tax/home-bonus-card";
import { TaxSection, TONE_BOX, TONE_TEXT, type Tone } from "@/components/tax/ui";
import { STAGES, STAGE_LABELS, longDay, type Stage } from "@/lib/tax/calendar";
import { RULES_CHECKED_AT } from "@/lib/finance/deductions";
import { TAX_SOURCES } from "@/lib/tax/rules";
import {
  HOME_LABELS,
  LIFE_EVENT_LABELS,
  OTHER_INCOME_LABELS,
  WORK_LABELS,
  isAnswered,
  type Light,
} from "@/lib/tax/situation";
import type { My730 } from "@/lib/data/my730";
import type { CoupleView } from "@/lib/data/my730-couple";
import { cn } from "@/lib/utils";

const LIGHT: Record<Light, { tone: Tone; label: string; dot: string }> = {
  green: { tone: "good", label: "Verde", dot: "bg-emerald-500" },
  yellow: { tone: "warn", label: "Giallo", dot: "bg-amber-500" },
  red: { tone: "bad", label: "Rosso", dot: "bg-rose-500" },
};

/** The sections, in the order that makes sense at each stage of the year. */
const ORDER: Record<Stage, string[]> = {
  year: ["alerts", "folder", "documents", "estimate", "homebonus", "couple", "precompiled"],
  prepare: ["estimate", "documents", "alerts", "folder", "homebonus", "couple", "precompiled"],
  precompiled: [
    "precompiled",
    "documents",
    "homebonus",
    "estimate",
    "alerts",
    "folder",
    "couple",
    "send",
  ],
  send: ["precompiled", "send", "documents", "homebonus", "estimate", "alerts", "folder", "couple"],
  after: ["after", "send", "estimate", "documents", "folder", "homebonus", "alerts"],
};

export function My730View({ data, couple }: { data: My730; couple: CoupleView | null }) {
  const answered = isAnswered(data.situation);
  const [editing, setEditing] = useState(!answered);

  const sections: Record<string, ReactNode> = {
    alerts: data.alerts.length > 0 && <AlertsCard data={data} key="alerts" />,
    folder: (
      <FolderCard
        key="folder"
        year={data.year}
        byType={data.summary.byType}
        lines={data.lines}
        refund={data.summary.refund}
        marginal={data.marginal}
      />
    ),
    documents: (
      <DocumentsCard
        key="documents"
        year={data.year}
        items={data.documents}
        states={data.docStates}
        caf={data.decision === "CAF" || data.channel === "CAF" || data.assessment?.light === "red"}
        pro={data.pro}
        answered={answered}
      />
    ),
    estimate: (
      <EstimateCard
        key="estimate"
        year={data.year}
        cu={data.cu}
        simulation={data.simulation}
        moreEmployers={data.situation.moreEmployers}
      />
    ),
    couple: couple && <CoupleCard key="couple" year={data.year} couple={couple} />,
    homebonus: (
      <HomeBonusCard
        key="homebonus"
        year={data.year}
        bonuses={data.homeBonuses}
        instalments={data.instalments}
        mainHome={data.situation.home === "mortgage" || data.situation.home === "owner"}
      />
    ),
    precompiled: <PrecompiledCard key="precompiled" data={data} />,
    send: <SendCard key="send" data={data} />,
    after: <AfterCard key="after" data={data} />,
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <NextStepHero data={data} onAnswer={() => setEditing(true)} />
      <Timeline data={data} />

      <TaxSection
        id="chi-sei"
        icon={UserRound}
        title="Chi sei"
        subtitle={
          answered
            ? `Le tue risposte sul ${data.year}: decidono il semaforo e i documenti.`
            : "Sei domande, due minuti: per dirti se puoi fare da solo e cosa preparare."
        }
        aside={
          answered && !editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Cambia le risposte
            </Button>
          ) : null
        }
      >
        {editing ? (
          <SituationWizard
            year={data.year}
            initial={
              answered
                ? data.situation
                : {
                    ...data.situation,
                    home: data.profile.rent.contract ? "rent" : data.situation.home,
                  }
            }
            onDone={() => setEditing(false)}
          />
        ) : (
          <Assessment data={data} />
        )}
      </TaxSection>

      {ORDER[data.stage].map((key) => sections[key])}

      <nav aria-label="Altri strumenti" className="grid gap-3 sm:grid-cols-3">
        {[
          {
            href: "/730/lettera",
            icon: MailOpen,
            title: "Spiegami questa lettera",
            text: "Una lettera dell'Agenzia o dell'INPS, spiegata con la scadenza.",
          },
          {
            href: "/isee",
            icon: BadgePercent,
            title: "ISEE e bonus",
            text: "Quando rinnovarlo, i numeri dei conti e i bonus possibili.",
          },
          {
            href: `/ritrovati/radar?anno=${data.year}`,
            icon: KeyRound,
            title: "Affitto e welfare",
            text: "La detrazione per l'affitto e il credito welfare in scadenza.",
          },
        ].map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="bg-card hover:bg-muted/40 flex gap-3 rounded-2xl border p-4 text-sm transition-colors"
          >
            <tool.icon
              className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400"
              aria-hidden
            />
            <span>
              <span className="block font-medium">{tool.title}</span>
              <span className="text-muted-foreground">{tool.text}</span>
            </span>
          </Link>
        ))}
      </nav>

      <footer className="text-muted-foreground grid gap-2 text-xs">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Questo è un promemoria personale, non un documento fiscale. Orbitly ti informa e ti
            guida, ma non compila e non invia la dichiarazione: il 730 lo invii tu sul sito
            dell&apos;Agenzia delle Entrate, oppure lo fa un CAF o un professionista. Le cifre sono
            stime con le regole verificate a {RULES_CHECKED_AT}
            {data.rules.provisional
              ? "; alcune date del calendario le conferma l'Agenzia in primavera"
              : ""}
            .
          </span>
        </p>
        <p>
          Fonti:{" "}
          {TAX_SOURCES.map((s, i) => (
            <span key={s.url}>
              {i > 0 && " · "}
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                {s.label}
              </a>
            </span>
          ))}
        </p>
      </footer>
    </div>
  );
}

function NextStepHero({ data, onAnswer }: { data: My730; onAnswer: () => void }) {
  const { next } = data;
  const anchor: Record<string, string> = {
    situation: "chi-sei",
    documents: "documenti",
    folder: "cartellina",
    estimate: "stima",
    precompiled: "precompilato",
    send: "invio",
    after: "dopo",
  };
  return (
    <section
      className="relative overflow-hidden rounded-3xl p-6 text-white sm:p-8"
      style={{ background: "linear-gradient(135deg, #4338ca, #7c3aed 50%, #a21caf)" }}
      aria-labelledby="next-step-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #f0abfc, transparent 70%)" }}
      />
      <p className="flex items-center gap-2 text-sm text-white/80">
        <Sparkles className="size-4" aria-hidden /> {data.rules.model} · Il prossimo passo
      </p>
      <h2
        id="next-step-title"
        className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {next.title}
      </h2>
      <p className="mt-2 max-w-2xl text-white/85">{next.text}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {next.target === "situation" ? (
          <button
            type="button"
            onClick={() => {
              onAnswer();
              document.getElementById("chi-sei")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-white/90"
          >
            Inizia <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : (
          <a
            href={`#${anchor[next.target]}`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-white/90"
          >
            Vai <ArrowRight className="size-4" aria-hidden />
          </a>
        )}
        {next.due && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm">
            <CalendarClock className="size-4" aria-hidden /> entro il {longDay(next.due)}
          </span>
        )}
        {data.summary.refund > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm">
            Spese che ti rendono circa{" "}
            {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
              data.summary.refund,
            )}
          </span>
        )}
      </div>
    </section>
  );
}

function Timeline({ data }: { data: My730 }) {
  const current = STAGES.indexOf(data.stage);
  return (
    <section aria-label="Il tuo anno del 730" className="bg-card rounded-2xl border p-5">
      <ol className="grid gap-4 sm:grid-cols-5 sm:gap-3">
        {data.timeline.map((t, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={t.stage} className="relative flex gap-3 sm:block">
              <div className="flex items-center gap-2 sm:mb-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    done && "border-emerald-500 bg-emerald-500 text-white",
                    now && "border-violet-500 bg-violet-500 text-white ring-4 ring-violet-500/20",
                  )}
                >
                  {done ? <CheckCircle2 className="size-4" aria-hidden /> : i + 1}
                </span>
                {i < data.timeline.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "hidden h-px flex-1 sm:block",
                      done ? "bg-emerald-500" : "bg-border",
                    )}
                  />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    now && "text-violet-700 dark:text-violet-300",
                  )}
                >
                  {STAGE_LABELS[t.stage]}
                  {now && (
                    <span className="ml-2 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                      Sei qui
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">{t.when}</p>
                <p className="text-muted-foreground mt-1 text-xs">{t.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Assessment({ data }: { data: My730 }) {
  const a = data.assessment;
  const s = data.situation;
  if (!a) return null;
  const light = LIGHT[a.light];
  const facts = [
    s.work && WORK_LABELS[s.work],
    s.moreEmployers && "più datori di lavoro",
    s.home && HOME_LABELS[s.home],
    s.spouse && "coniuge a carico",
    s.children > 0 && `${s.children} ${s.children === 1 ? "figlio" : "figli"} a carico`,
    s.parents > 0 && `${s.parents} ${s.parents === 1 ? "genitore" : "genitori"} a carico`,
    ...s.otherIncome.map((i) => OTHER_INCOME_LABELS[i]),
    ...s.events.map((e) => LIFE_EVENT_LABELS[e]),
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-4">
      <div className={cn("grid gap-3 rounded-xl border p-4", TONE_BOX[light.tone])}>
        <div className="flex items-center gap-3">
          <span className="flex gap-1" aria-hidden>
            {(["red", "yellow", "green"] as Light[]).map((l) => (
              <span
                key={l}
                className={cn(
                  "size-3 rounded-full",
                  l === a.light ? LIGHT[l].dot : "bg-muted-foreground/20",
                )}
              />
            ))}
          </span>
          <p className={cn("font-semibold", TONE_TEXT[light.tone])}>
            <span className="sr-only">Semaforo {light.label}: </span>
            {a.title}
          </p>
        </div>
        <ul className="grid gap-1.5 text-sm">
          {a.reasons.map((r) => (
            <li key={r} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-60"
              />
              {r}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-4 text-sm">
          <p className="font-medium">Devo farlo?</p>
          <p className="text-muted-foreground mt-1">{a.obligation.text}</p>
        </div>
        <div className="rounded-xl border p-4 text-sm">
          <p className="font-medium">Chi mi dà i soldi?</p>
          <p className="text-muted-foreground mt-1">
            {a.noAgent
              ? "Nessuno ti paga a luglio: il rimborso arriva dall'Agenzia sul tuo conto (ricordati l'IBAN), un debito lo paghi tu con l'F24."
              : data.situation.work === "pensioner"
                ? "L'ente che ti paga la pensione: rimborso o trattenuta da agosto o settembre."
                : "Il tuo datore di lavoro: rimborso o trattenuta in busta paga, di solito da luglio."}
          </p>
        </div>
      </div>
      {facts.length > 0 && (
        <p className="text-muted-foreground text-xs">Le tue risposte: {facts.join(" · ")}.</p>
      )}
    </div>
  );
}

const ALERT_ICON: Record<string, typeof Info> = {
  warn: AlertTriangle,
  good: CheckCircle2,
  info: Info,
};

function AlertsCard({ data }: { data: My730 }) {
  return (
    <TaxSection
      id="avvisi"
      icon={BellRing}
      title="Gli avvisi"
      subtitle="Le cose da sapere adesso, prima che costino qualcosa."
    >
      <ul className="grid gap-2">
        {data.alerts.map((a) => {
          const Icon = ALERT_ICON[a.tone];
          return (
            <li
              key={a.key}
              className={cn("flex gap-3 rounded-xl border p-3 text-sm", TONE_BOX[a.tone])}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[a.tone])} aria-hidden />
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-muted-foreground">{a.text}</p>
                {a.href && (
                  <Link
                    href={a.href}
                    className="mt-1 inline-flex text-sm font-medium underline-offset-2 hover:underline"
                  >
                    Vai
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </TaxSection>
  );
}
