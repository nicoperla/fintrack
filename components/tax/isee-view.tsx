"use client";

import { useState, type FormEvent } from "react";
import {
  BadgePercent,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Landmark,
  ListChecks,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChoiceCard, Stepper, TaxSection, TONE_BOX } from "@/components/tax/ui";
import { IseeEstimateCard } from "@/components/tax/isee-estimate-card";
import { saveIsee } from "@/app/(dashboard)/isee/actions";
import {
  BONUSES_CHECKED_AT,
  EMPTY_BONUS_ANSWERS,
  findBonuses,
  type BonusAnswers,
  type BonusMatch,
} from "@/lib/tax/bonuses";
import { ISEE_CHECKED_AT, type AccountFigures } from "@/lib/tax/isee";
import { longDay } from "@/lib/tax/calendar";
import { formatCurrency } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import type { IseeData } from "@/lib/data/isee";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<AccountFigures["type"], string> = {
  CHECKING: "Conto corrente",
  CASH: "Contanti",
  CARD: "Carta",
  SAVINGS: "Risparmio",
  INVESTMENT: "Investimenti",
};

export function IseeView({ data }: { data: IseeData }) {
  // The estimate, when the user chooses to use it for the bonuses.
  const [estimate, setEstimate] = useState<{ ordinary: number; family: number } | null>(null);
  return (
    <div className="grid grid-cols-1 gap-6">
      <Hero data={data} />
      <HowTo data={data} />
      <AccountsCard data={data} />
      <IseeEstimateCard data={data} onUse={setEstimate} />
      <BonusFinder
        key={estimate ? `${estimate.ordinary}-${estimate.family}` : "saved"}
        data={data}
        estimate={estimate}
      />
      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Orbitly ti informa: la DSU la presenti tu sul sito dell&apos;INPS o con un CAF, e le
          domande dei bonus le fai tu sui siti degli enti. Regole verificate a {ISEE_CHECKED_AT};
          importi e soglie dei bonus a {BONUSES_CHECKED_AT}: cambiano ogni anno, controllali prima
          di fare domanda.
        </span>
      </p>
    </div>
  );
}

function Hero({ data }: { data: IseeData }) {
  const money = useMoney();
  const c = data.calendar;
  const have = data.isee.year === data.iseeYear && data.isee.value !== null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = have
    ? {
        title: `Il tuo ISEE ${data.iseeYear}: ${money(data.isee.value!)}`,
        text: `Vale fino al 31 dicembre ${data.iseeYear}. Qui sotto i bonus che potrebbero spettarti.`,
      }
    : data.today < c.renewFrom
      ? {
          title: `A gennaio si rinnova l'ISEE ${data.iseeYear}`,
          text: `Quello di quest'anno scade il 31 dicembre. Il nuovo usa i saldi e i redditi del ${data.baseYear}: qui sotto ci sono già i numeri dei tuoi conti.`,
        }
      : data.today <= c.assegnoUnicoBy
        ? {
            title: `Rinnova l'ISEE entro il ${longDay(c.assegnoUnicoBy)}`,
            text: "Se prendi l'Assegno unico, così da marzo non scendi all'importo minimo.",
          }
        : data.today <= c.arrearsBy
          ? {
              title: `L'ISEE ${data.iseeYear} entro il ${longDay(c.arrearsBy)}`,
              text: "Con l'Assegno unico, presentandolo entro il 30 giugno ricevi anche gli arretrati da marzo.",
            }
          : {
              title: `L'ISEE ${data.iseeYear} vale fino al 31 dicembre`,
              text: "Fallo quando serve per un bonus o una prestazione: con la DSU precompilata bastano pochi minuti.",
            };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const res = await saveIsee({
      value: String(form.get("value") ?? ""),
      year: data.iseeYear,
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setSaving(false);
    setError(res.fieldErrors?.value?.[0] ?? res.error ?? null);
    if (res.ok) toast.success("ISEE salvato: ho aggiornato i bonus");
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-6 text-white sm:p-8"
      style={{ background: "linear-gradient(135deg, #0f766e, #0e7490 50%, #4338ca)" }}
      aria-labelledby="isee-step"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #99f6e4, transparent 70%)" }}
      />
      <p className="flex items-center gap-2 text-sm text-white/80">
        <Sparkles className="size-4" aria-hidden /> ISEE {data.iseeYear}
      </p>
      <h2
        id="isee-step"
        className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {step.title}
      </h2>
      <p className="mt-2 max-w-2xl text-white/85">{step.text}</p>
      <form onSubmit={onSubmit} className="mt-5 flex flex-wrap items-end gap-2" noValidate>
        <label className="grid gap-1 text-sm">
          <span className="text-white/80">
            {have ? "Cambia il valore" : "Hai già l'attestazione? Scrivi il valore"}
          </span>
          <Input
            name="value"
            inputMode="decimal"
            placeholder="Es. 18.500"
            defaultValue={have ? String(data.isee.value).replace(".", ",") : ""}
            className="w-40 border-white/30 bg-white/10 text-white placeholder:text-white/50"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-white/90"
        >
          {saving ? "Salvo…" : "Salva"}
        </button>
        {error && <p className="w-full text-sm text-rose-100">{error}</p>}
      </form>
    </section>
  );
}

function HowTo({ data }: { data: IseeData }) {
  const steps = [
    "Entra nel sito dell'INPS con SPID, CIE o CNS e cerca «ISEE precompilato».",
    "Indica chi fa parte del nucleo: gli altri maggiorenni danno il consenso con il loro accesso, oppure firmi tu una delega.",
    `Controlla i dati che l'INPS prende da Agenzia delle Entrate e banche (redditi e saldi del ${data.baseYear}): accetta o correggi.`,
    "Invia: l'attestazione arriva di solito in pochi giorni. In alternativa, la DSU la fa gratis un CAF.",
  ];
  return (
    <TaxSection
      id="come"
      icon={ListChecks}
      title="Come si fa"
      subtitle={`L'ISEE ${data.iseeYear} guarda redditi e risparmi del ${data.baseYear}, e scade il 31 dicembre.`}
    >
      <ol className="grid gap-2 text-sm sm:grid-cols-2">
        {steps.map((text, i) => (
          <li key={text} className="flex gap-3 rounded-xl border p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-xs font-semibold text-teal-700 dark:text-teal-300">
              {i + 1}
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <ul className="text-muted-foreground grid gap-1 text-xs">
        <li className="flex items-center gap-2">
          <CalendarClock className="size-3.5" aria-hidden /> Da gennaio si può presentare la DSU
          dell&apos;anno nuovo.
        </li>
        <li className="flex items-center gap-2">
          <CalendarClock className="size-3.5" aria-hidden /> Assegno unico: entro fine febbraio per
          non scendere al minimo da marzo, entro il 30 giugno per avere gli arretrati.
        </li>
      </ul>
    </TaxSection>
  );
}

function FiguresTable({ accounts, ongoing }: { accounts: AccountFigures[]; ongoing: boolean }) {
  // Each account in its own currency: the DSU wants the figures as on the statements.
  const money = (n: number, currency: string) => formatCurrency(n, currency);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-xs">
            <th className="py-2 font-medium">Conto</th>
            <th className="py-2 text-right font-medium">
              {ongoing ? "Saldo a oggi" : "Saldo al 31 dicembre"}
            </th>
            <th className="py-2 text-right font-medium">Giacenza media</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {accounts.map((a) => (
            <tr key={a.id}>
              <td className="py-2">
                {a.name}
                <span className="text-muted-foreground block text-xs">{TYPE_LABELS[a.type]}</span>
              </td>
              <td className="py-2 text-right tabular-nums">{money(a.end, a.currency)}</td>
              <td className="py-2 text-right tabular-nums">
                {a.type === "INVESTMENT" ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  money(a.average, a.currency)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountsCard({ data }: { data: IseeData }) {
  return (
    <TaxSection
      id="conti"
      icon={Landmark}
      title="I numeri dei tuoi conti"
      subtitle="La DSU chiede, per ogni conto, il saldo al 31 dicembre e la giacenza media dell'anno: li calcolo dai tuoi movimenti."
    >
      {!data.years.some((y) => y.year === data.baseYear) && (
        <p className="text-muted-foreground text-sm">
          In Orbitly non ci sono movimenti del {data.baseYear}: per l&apos;ISEE {data.iseeYear}{" "}
          saldo e giacenza li trovi negli estratti conto (o te li dà la banca).
        </p>
      )}
      {data.years.map((y) => (
        <div key={y.year} className="grid gap-2">
          <p className="text-sm font-medium">
            Per l&apos;ISEE {y.iseeYear} (anno {y.year}
            {y.ongoing ? ", fino a oggi" : ""})
          </p>
          <FiguresTable accounts={y.accounts!} ongoing={y.ongoing} />
          {y.partial && (
            <p className={cn("rounded-lg border p-3 text-xs", TONE_BOX.warn)}>
              Orbitly ha i movimenti solo da quando hai iniziato a usarlo, dopo il 1° gennaio{" "}
              {y.year}: per i mesi prima la giacenza conta zero, quindi è approssimata. Il valore
              giusto è nell&apos;estratto conto di fine anno o lo chiedi alla banca.
            </p>
          )}
        </div>
      ))}
      <p className="text-muted-foreground text-xs">
        Contanti esclusi. Per gli investimenti la DSU vuole il valore al 31 dicembre
        dell&apos;estratto, non la giacenza. I conti sono quelli dello spazio: nella DSU vanno
        quelli di tutto il nucleo familiare, ciascuno con il suo intestatario.
      </p>
    </TaxSection>
  );
}

const MATCH: Record<BonusMatch, { label: string; icon: typeof CheckCircle2; className: string }> = {
  yes: {
    label: "Potresti averne diritto",
    icon: CheckCircle2,
    className: "text-emerald-700 dark:text-emerald-400",
  },
  maybe: { label: "Da verificare", icon: CircleHelp, className: "text-sky-700 dark:text-sky-400" },
  isee: {
    label: "Dipende dall'ISEE",
    icon: CircleHelp,
    className: "text-amber-700 dark:text-amber-400",
  },
  no: { label: "Non sembra", icon: XCircle, className: "text-muted-foreground" },
};

function BonusFinder({
  data,
  estimate,
}: {
  data: IseeData;
  estimate: { ordinary: number; family: number } | null;
}) {
  const [a, setA] = useState<BonusAnswers>({
    ...EMPTY_BONUS_ANSWERS,
    isee: estimate?.ordinary ?? data.isee.value,
    iseeFamily: estimate?.family ?? null,
    people: Math.max(1, 1 + data.hints.children),
    childrenUnder21: data.hints.children,
    newborn: data.hints.newborn,
    age: data.hints.age,
    rent: data.hints.rent,
    workless: data.hints.workless,
  });
  const [showAll, setShowAll] = useState(false);
  const set = (patch: Partial<BonusAnswers>) => setA((prev) => ({ ...prev, ...patch }));
  const results = findBonuses(a);
  const likely = results.filter((r) => r.match !== "no");
  const shown = showAll ? results : likely;

  return (
    <TaxSection
      id="bonus"
      icon={BadgePercent}
      title="Trova bonus"
      subtitle="Qualche domanda e ti dico quali bonus nazionali potrebbero spettarti, e come chiederli."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
          <span className="font-medium">Persone in famiglia</span>
          <Stepper
            value={a.people}
            onChange={(people) => set({ people: Math.max(1, people) })}
            max={12}
            label="Persone in famiglia"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
          <span className="font-medium">Figli sotto i 21 anni</span>
          <Stepper
            value={a.childrenUnder21}
            onChange={(childrenUnder21) => set({ childrenUnder21 })}
            max={10}
            label="Figli sotto i 21 anni"
          />
        </div>
        <label className="grid gap-1 rounded-xl border p-3 text-sm">
          <span className="font-medium">La tua età</span>
          <Input
            inputMode="numeric"
            placeholder="Es. 34"
            value={a.age ?? ""}
            onChange={(e) =>
              set({
                age: e.target.value ? Number(e.target.value.replace(/\D/g, "")) || null : null,
              })
            }
          />
        </label>
        <div className="grid gap-1 rounded-xl border p-3 text-sm">
          <span className="font-medium">ISEE</span>
          <span className="text-muted-foreground text-xs">
            {a.isee === null
              ? "Non lo so ancora: te lo dico per ogni bonus (o fai la stima qui sopra)."
              : estimate
                ? `Uso le stime: ${Math.round(a.isee).toLocaleString("it-IT")} €, e ${Math.round(a.iseeFamily ?? a.isee).toLocaleString("it-IT")} € per Assegno unico, nido, nuovi nati e ADI.`
                : `Uso ${a.isee.toLocaleString("it-IT")} €, quello che hai salvato.`}
          </span>
          {a.isee !== null && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="justify-self-start"
              onClick={() => set({ isee: null, iseeFamily: null })}
            >
              Fai finta di non saperlo
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ["childUnder3", "Un figlio sotto i 3 anni"],
            ["childUnder6", "Un figlio sotto i 6 anni"],
            ["newborn", "Un figlio nato o adottato da poco"],
            ["turning18", "Un figlio che compie 18 anni"],
            ["rent", "Vivo in affitto"],
            ["workless", "Senza lavoro"],
          ] as const
        ).map(([key, label]) => (
          <ChoiceCard
            key={key}
            type="checkbox"
            name={key}
            checked={a[key]}
            onChange={(on) => set({ [key]: on })}
            label={label}
          />
        ))}
      </div>

      <ul className="grid gap-2">
        {shown.map(({ bonus, match }) => {
          const m = MATCH[match];
          const Icon = m.icon;
          return (
            <li
              key={bonus.key}
              className={cn(
                "grid gap-2 rounded-xl border p-4 text-sm",
                match === "no" && "opacity-60",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{bonus.title}</p>
                <span className={cn("flex items-center gap-1 text-xs font-medium", m.className)}>
                  <Icon className="size-3.5" aria-hidden /> {m.label}
                </span>
              </div>
              <p>{bonus.amount}</p>
              <p className="text-muted-foreground">{bonus.who}</p>
              <ul className="text-muted-foreground grid gap-0.5 text-xs">
                {bonus.how.map((h) => (
                  <li key={h}>· {h}</li>
                ))}
              </ul>
              <p className="text-xs">
                Dove: <span className="font-medium">{bonus.where}</span>
              </p>
            </li>
          );
        })}
      </ul>
      {likely.length < results.length && (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Mostra solo quelli possibili" : `Mostra tutti (${results.length})`}
        </Button>
      )}
    </TaxSection>
  );
}
