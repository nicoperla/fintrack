"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Baby,
  Banknote,
  Bus,
  Check,
  Copy,
  Files as Duplicate,
  Download,
  FileText,
  House,
  Landmark,
  Lock,
  Mail,
  PawPrint,
  School,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatedCurrency } from "@/components/dashboard/animated-currency";
import { useMoney } from "@/components/currency-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DEDUCTION_TYPES,
  RULES,
  RULES_CHECKED_AT,
  type DeductionLine,
  type DeductionType,
  type TypeSummary,
} from "@/lib/finance/deductions";
import { cancellationLetter } from "@/lib/finance/found-money";
import type { FoundMoney } from "@/lib/data/found-money";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import {
  dismissFinding,
  setDeduction,
  setDependentChildren,
} from "@/app/(dashboard)/ritrovati/actions";

export const DEDUCTION_ICONS: Record<DeductionType, LucideIcon> = {
  sanitarie: Stethoscope,
  veterinarie: PawPrint,
  istruzione: School,
  sport: Trophy,
  asilo: Baby,
  trasporto: Bus,
  assicurazione: ShieldCheck,
  mutuo: House,
};

const shortDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fmtDate = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

function useAction() {
  const [pending, start] = useTransition();
  const run = (action: () => Promise<ActionResult>, success?: string) =>
    start(async () => {
      const res = await action().catch((): ActionResult => ({ ok: false }));
      if (res.ok) {
        if (success) toast.success(success);
      } else toast.error(res.error ?? "Operazione non riuscita. Riprova.");
    });
  return { pending, run };
}

function Section({
  id,
  icon: Icon,
  title,
  subtitle,
  aside,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="bg-card grid scroll-mt-20 gap-4 rounded-2xl border p-5"
      aria-labelledby={`${id}-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="flex items-center gap-2 font-medium">
            <Icon className="size-4" aria-hidden /> {title}
          </h2>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Free plan: the numbers are visible, the details are behind Pro. */
function ProLock({ what }: { what: string }) {
  return (
    <Link
      href="/settings#abbonamento"
      className="bg-muted/50 hover:bg-muted relative flex items-center gap-3 overflow-hidden rounded-xl border border-dashed p-4 text-sm transition-colors"
    >
      <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
        <Lock className="size-4" aria-hidden />
      </span>
      <span>
        <span className="font-medium">Con Pro vedi {what}.</span>{" "}
        <span className="text-muted-foreground">Sbloccalo dalle impostazioni.</span>
      </span>
    </Link>
  );
}

function Hero({ data }: { data: FoundMoney }) {
  const money = useMoney();
  const { summary } = data;
  const chips = [
    { show: summary.refund > 0, label: `Rimborso 730 stimato ${money(summary.refund)}` },
    {
      show: summary.duplicates.count > 0,
      label: `Possibili doppi addebiti ${money(summary.duplicates.total)}`,
    },
    {
      show: summary.renewals.count > 0,
      label: `Rinnovi da valutare ${money(summary.renewals.total)}`,
    },
    {
      show: summary.priceIncreases.count > 0,
      label: `Aumenti ${money(summary.priceIncreases.yearly)}/anno`,
    },
    {
      show: summary.bankFees !== null,
      label: `Commissioni ${money(summary.bankFees?.yearly ?? 0)}/anno`,
    },
  ].filter((c) => c.show);

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-6 text-white sm:p-8"
      style={{ background: "linear-gradient(135deg, #047857, #0d9488 50%, #0369a1)" }}
      aria-label="Soldi ritrovati"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #a7f3d0, transparent 70%)" }}
      />
      <p className="flex items-center gap-2 text-sm text-white/80">
        <Sparkles className="size-4" aria-hidden /> Nel {data.year} FinTrack ha trovato
      </p>
      <AnimatedCurrency
        value={data.total}
        className="mt-1 block text-5xl font-semibold tracking-tight sm:text-6xl"
      />
      <p className="mt-1 text-white/85">
        {data.total > 0
          ? "da farti rimborsare o da smettere di perdere."
          : "Per ora niente da recuperare: continua a registrare le spese, ti avviso io."}
      </p>
      {chips.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2 text-sm">
          {chips.map((c) => (
            <li
              key={c.label}
              className="rounded-full bg-white/15 px-3 py-1 tabular-nums backdrop-blur"
            >
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TypeCard({ summary }: { summary: TypeSummary }) {
  const money = useMoney();
  const Icon = DEDUCTION_ICONS[summary.type];
  const rule = RULES[summary.type];
  const toFranchigia = summary.franchigia !== null ? summary.franchigia - summary.eligible : 0;
  const capReached = summary.cap !== null && summary.eligible >= summary.cap;
  return (
    <li className="grid content-start gap-2 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Icon className="size-4" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 font-medium">{summary.label}</p>
        <p className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
          +{money(summary.refund)}
        </p>
      </div>
      <p className="text-muted-foreground text-sm">
        {money(summary.eligible)} di spese valide
        {summary.cap !== null && ` su un massimo di ${money(summary.cap)}`}.
        {summary.belowFranchigia && toFranchigia > 0
          ? ` Mancano ${money(toFranchigia)} alla franchigia: sotto ${money(summary.franchigia!)} non si recupera niente.`
          : capReached
            ? " Hai raggiunto il limite: le spese in più non aumentano il rimborso."
            : ""}
      </p>
      {summary.lostToCash > 0 && (
        <p className="flex items-start gap-1.5 text-sm text-(--warn-text)">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Circa {money(summary.lostToCash)} persi pagando in contanti.
        </p>
      )}
      {rule.note && <p className="text-muted-foreground text-xs">{rule.note}</p>}
    </li>
  );
}

const STATUS_LABEL: Record<DeductionLine["status"], string> = {
  ok: "Conta",
  cash: "Contanti: non conta",
  check: "Da confermare",
  excluded: "Esclusa",
};

function DeductionRow({ line, memberName }: { line: DeductionLine; memberName: string | null }) {
  const money = useMoney();
  const { pending, run } = useAction();
  const [choosing, setChoosing] = useState(false);
  const type = line.type;
  return (
    <li className="grid gap-2 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{line.description}</p>
          <p className="text-muted-foreground text-xs">
            {fmtDate(line.date)} · {line.account}
            {line.category ? ` · ${line.category}` : ""}
            {memberName ? ` · ${memberName}` : ""}
            {type ? ` · ${RULES[type].label}` : ""}
          </p>
          {line.reason && <p className="text-muted-foreground text-xs">{line.reason}</p>}
        </div>
        <div className="text-right">
          <p className="tabular-nums">{money(line.amount)}</p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px]",
              line.status === "ok" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              line.status === "cash" && "bg-amber-500/15 text-(--warn-text)",
              line.status === "check" && "bg-sky-500/10 text-sky-700 dark:text-sky-400",
              line.status === "excluded" && "bg-muted text-muted-foreground",
            )}
          >
            {STATUS_LABEL[line.status]}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {line.status === "check" && type && (
          <Button
            size="xs"
            disabled={pending}
            onClick={() => run(() => setDeduction(line.id, type), "Aggiunta al 730")}
          >
            <Check /> Sì, conta
          </Button>
        )}
        {line.status !== "excluded" ? (
          <Button
            size="xs"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => setDeduction(line.id, "none"), "Tolta dal 730")}
          >
            <X /> Non è detraibile
          </Button>
        ) : (
          <Button
            size="xs"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => setDeduction(line.id, null), "Tornata automatica")}
          >
            Ripristina
          </Button>
        )}
        <Button size="xs" variant="ghost" disabled={pending} onClick={() => setChoosing(!choosing)}>
          Cambia tipo
        </Button>
      </div>
      {choosing && (
        <div className="flex flex-wrap gap-1.5">
          {DEDUCTION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              disabled={pending}
              onClick={() => {
                setChoosing(false);
                run(() => setDeduction(line.id, t), `Segnata come ${RULES[t].label.toLowerCase()}`);
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                t === type ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {RULES[t].label}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function ChildrenControl({ value }: { value: number }) {
  const { pending, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Figli a carico:</span>
      {[0, 1, 2, 3, 4].map((n) => (
        <button
          key={n}
          type="button"
          disabled={pending}
          aria-pressed={value === n}
          onClick={() => run(() => setDependentChildren(n), "Aggiornato")}
          className={cn(
            "min-w-8 rounded-md border px-2 py-0.5",
            value === n ? "bg-foreground text-background" : "hover:bg-muted",
          )}
        >
          {n === 4 ? "4+" : n}
        </button>
      ))}
    </div>
  );
}

function TaxSection({ data }: { data: FoundMoney }) {
  const money = useMoney();
  const [showAll, setShowAll] = useState(false);
  const [who, setWho] = useState<"io" | "tutti">("io");
  const { summary, details } = data;
  const memberName = new Map(summary.members.map((m) => [m.id, m.isYou ? "tu" : m.name]));
  const you = summary.members.find((m) => m.isYou);
  const lines = details?.lines ?? [];
  const toCheck = lines.filter((l) => l.status === "check");
  const others = lines.filter((l) => l.status !== "check");
  const shown = showAll ? others : others.slice(0, 6);

  return (
    <Section
      id="730"
      icon={FileText}
      title={`Il tuo 730/${data.year + 1}`}
      subtitle={`Le spese detraibili del ${data.year}, raccolte mentre le registri.`}
      aside={
        details ? (
          <div className="flex flex-wrap items-center gap-2">
            {data.shared && (
              <div
                className="bg-muted inline-flex rounded-lg p-0.5 text-xs"
                role="group"
                aria-label="Di chi"
              >
                {(["io", "tutti"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={who === v}
                    onClick={() => setWho(v)}
                    className={cn(
                      "rounded-md px-2 py-1",
                      who === v && "bg-background font-medium shadow-sm",
                    )}
                  >
                    {v === "io" ? "Le mie" : "Di tutti"}
                  </button>
                ))}
              </div>
            )}
            <a
              href={`/api/ritrovati/dossier?anno=${data.year}&chi=${who}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download /> Dossier 730 (PDF)
            </a>
          </div>
        ) : null
      }
    >
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="text-muted-foreground text-sm">Rimborso IRPEF stimato</p>
          <p className="text-3xl font-semibold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
            {money(summary.refund)}
          </p>
        </div>
        {data.shared && (
          <p className="text-muted-foreground text-sm">
            {summary.members
              .filter((m) => m.refund > 0 || m.isYou)
              .map((m) => `${m.isYou ? "Tu" : m.name}: ${money(m.refund)}`)
              .join(" · ")}
          </p>
        )}
        {summary.lostToCash > 0 && (
          <p className="flex items-center gap-1.5 text-sm text-(--warn-text)">
            <AlertTriangle className="size-4" aria-hidden />
            {money(summary.lostToCash)} persi per pagamenti in contanti
          </p>
        )}
      </div>

      {summary.byType.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {summary.byType.map((t) => (
            <TypeCard key={t.type} summary={t} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Ancora nessuna spesa detraibile nel {data.year}. Farmacia, visite, veterinario, scuola,
          sport dei figli, abbonamenti ai mezzi: registrali con la loro categoria e li raccolgo io.
        </p>
      )}

      <ChildrenControl value={data.children} />

      {details ? (
        <>
          {toCheck.length > 0 && (
            <div className="grid gap-1 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 pt-3">
              <p className="text-sm font-medium">
                {toCheck.length === 1
                  ? "1 spesa da confermare"
                  : `${toCheck.length} spese da confermare`}
              </p>
              <ul className="divide-y text-sm">
                {toCheck.map((l) => (
                  <DeductionRow
                    key={l.id}
                    line={l}
                    memberName={data.shared ? (memberName.get(l.memberId ?? "") ?? null) : null}
                  />
                ))}
              </ul>
            </div>
          )}
          {others.length > 0 && (
            <div className="grid gap-1">
              <p className="text-sm font-medium">Le spese raccolte</p>
              <ul className="divide-y text-sm">
                {shown.map((l) => (
                  <DeductionRow
                    key={l.id}
                    line={l}
                    memberName={data.shared ? (memberName.get(l.memberId ?? "") ?? null) : null}
                  />
                ))}
              </ul>
              {others.length > shown.length && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-self-start"
                  onClick={() => setShowAll(true)}
                >
                  Mostra tutte ({others.length})
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        (summary.byType.length > 0 || summary.toCheck > 0) && (
          <ProLock
            what={`quali spese contano${summary.toCheck ? `, le ${summary.toCheck} da confermare` : ""} e scarichi il dossier per il CAF`}
          />
        )
      )}

      <p className="text-muted-foreground text-xs">
        Stima con le regole in vigore a {RULES_CHECKED_AT} (19% di detrazione, franchigie e limiti
        per tipo). Non tiene conto dei tetti per redditi oltre 75.000 € né dell&apos;IRPEF che paghi
        davvero, che è il massimo che puoi recuperare. Verifica sempre col CAF o il commercialista:
        non è consulenza fiscale.
        {you && data.shared && " Le spese sono attribuite a chi le ha registrate."}
      </p>
    </Section>
  );
}

function DuplicatesSection({ data }: { data: FoundMoney }) {
  const money = useMoney();
  const { pending, run } = useAction();
  const { summary, details } = data;
  if (summary.duplicates.count === 0) return null;
  return (
    <Section
      id="doppi"
      icon={Duplicate}
      title="Possibili doppi addebiti"
      subtitle="Stesso importo, stesso negozio, stessa carta, a poche ore di distanza. Se è un errore, chiedi il rimborso al negozio o alla banca."
      aside={<span className="font-semibold tabular-nums">{money(summary.duplicates.total)}</span>}
    >
      {details ? (
        <ul className="divide-y text-sm">
          {details.duplicates.map((d) => (
            <li key={d.key} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.description}</p>
                <p className="text-muted-foreground text-xs">
                  {fmtDate(d.date)} · {d.account} · addebitato due volte
                </p>
              </div>
              <span className="tabular-nums">{money(d.amount)}</span>
              <Button
                size="xs"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => dismissFinding(d.key), "Segnato come corretto")}
              >
                Non è un errore
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <ProLock
          what={
            summary.duplicates.count === 1
              ? "qual è l'addebito sospetto"
              : `quali sono i ${summary.duplicates.count} addebiti sospetti`
          }
        />
      )}
    </Section>
  );
}

function LetterDialog({
  service,
  userName,
  today,
  onClose,
}: {
  service: string | null;
  userName: string;
  today: string;
  onClose: () => void;
}) {
  const letter = service ? cancellationLetter({ service, fullName: userName, today }) : null;
  const [body, setBody] = useState(letter?.body ?? "");
  const [lastService, setLastService] = useState(service);
  if (service !== lastService) {
    setLastService(service);
    setBody(letter?.body ?? "");
  }
  return (
    <Dialog open={service !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Disdetta {service}</DialogTitle>
          <DialogDescription>
            Completa i dati tra parentesi e inviala all&apos;indirizzo del servizio clienti (meglio
            via PEC se ce l&apos;hai). Molti servizi si disdicono anche dalle impostazioni
            dell&apos;account.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="text-sm"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() =>
              navigator.clipboard
                .writeText(body)
                .then(() => toast.success("Lettera copiata"))
                .catch(() => toast.error("Copia non riuscita"))
            }
          >
            <Copy /> Copia
          </Button>
          <a
            href={`mailto:?subject=${encodeURIComponent(letter?.subject ?? "")}&body=${encodeURIComponent(body)}`}
            className={buttonVariants()}
          >
            <Mail /> Apri nell&apos;email
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionsSection({ data }: { data: FoundMoney }) {
  const money = useMoney();
  const { pending, run } = useAction();
  const [letterFor, setLetterFor] = useState<string | null>(null);
  const { summary, details } = data;
  if (
    summary.subscriptions.count === 0 &&
    summary.priceIncreases.count === 0 &&
    summary.renewals.count === 0
  ) {
    return null;
  }
  return (
    <Section
      id="abbonamenti"
      icon={TrendingUp}
      title="Abbonamenti"
      subtitle={`${summary.subscriptions.count} attivi per ${money(summary.subscriptions.yearly)} l'anno. Quelli che non usi, disdicili con una lettera già pronta.`}
    >
      {details ? (
        <div className="grid gap-4">
          {details.renewals.map((r) => (
            <div
              key={r.key}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
            >
              <AlertTriangle className="size-4 shrink-0 text-(--warn-text)" aria-hidden />
              <p className="min-w-0 flex-1">
                <span className="font-medium">{r.name}</span> si rinnova{" "}
                {r.daysLeft === 0
                  ? "oggi"
                  : `tra ${r.daysLeft} ${r.daysLeft === 1 ? "giorno" : "giorni"}`}{" "}
                ({money(r.amount)}). Se non ti serve più, disdici prima.
              </p>
              <Button size="xs" onClick={() => setLetterFor(r.name)}>
                Scrivi la disdetta
              </Button>
              <Button
                size="xs"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => dismissFinding(r.key), "Ok, lo tieni")}
              >
                Lo tengo
              </Button>
            </div>
          ))}
          {details.priceIncreases.map((p) => (
            <div
              key={p.key}
              className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
            >
              <TrendingUp className="size-4 shrink-0 text-(--delta-bad)" aria-hidden />
              <p className="min-w-0 flex-1">
                <span className="font-medium">{p.name}</span> è passato da {money(p.from)} a{" "}
                {money(p.to)}:{" "}
                <span className="font-medium">{money(p.yearly)} in più all&apos;anno</span>.
              </p>
              <Button size="xs" variant="outline" onClick={() => setLetterFor(p.name)}>
                Scrivi la disdetta
              </Button>
              <Button
                size="xs"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => dismissFinding(p.key), "Ok, lo tieni")}
              >
                Va bene così
              </Button>
            </div>
          ))}
          <ul className="divide-y text-sm">
            {details.subscriptions.map((s) => (
              <li key={s.key} className="flex items-center gap-3 py-2.5">
                <p className="min-w-0 flex-1 truncate font-medium">{s.name}</p>
                <span className="text-muted-foreground tabular-nums">{money(s.yearly)}/anno</span>
                <Button size="xs" variant="outline" onClick={() => setLetterFor(s.name)}>
                  Disdetta
                </Button>
              </li>
            ))}
          </ul>
          <LetterDialog
            service={letterFor}
            userName={data.userName}
            today={data.today}
            onClose={() => setLetterFor(null)}
          />
        </div>
      ) : (
        <ProLock what="quali abbonamenti sono aumentati o stanno per rinnovarsi, con le lettere di disdetta pronte" />
      )}
    </Section>
  );
}

function BankFeesSection({ data }: { data: FoundMoney }) {
  const money = useMoney();
  const { pending, run } = useAction();
  const fees = data.summary.bankFees;
  if (!fees) return null;
  return (
    <Section
      id="commissioni"
      icon={Landmark}
      title="Commissioni bancarie"
      aside={<span className="font-semibold tabular-nums">{money(fees.yearly)}/anno</span>}
      subtitle="Canoni, commissioni e bolli che il conto ti costa in un anno. Un conto a zero spese te li farebbe risparmiare."
    >
      {data.details?.bankFees ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Banknote className="text-muted-foreground size-4" aria-hidden />
          <p className="text-muted-foreground min-w-0 flex-1">
            {data.details.bankFees.count} addebiti negli ultimi 12 mesi, per esempio{" "}
            {data.details.bankFees.examples.join(", ")}.
          </p>
          <Button
            size="xs"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => dismissFinding("fees"), "Ok")}
          >
            Non mi interessa
          </Button>
        </div>
      ) : (
        <ProLock what="quali addebiti ti costano e quanto" />
      )}
    </Section>
  );
}

export function FoundMoneyView({ data }: { data: FoundMoney }) {
  return (
    <div className="grid gap-6">
      <Hero data={data} />
      <TaxSection data={data} />
      <DuplicatesSection data={data} />
      <SubscriptionsSection data={data} />
      <BankFeesSection data={data} />
    </div>
  );
}
