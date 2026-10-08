"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  House,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useMoney, useWholeMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { JobPanel } from "@/components/crash-test/job-panel";
import { monthsText, Outcome, parseNumber, runOutMonth } from "@/components/crash-test/outcome";
import { FormField, SelectField } from "@/components/forms/form-field";
import { NativeSelectOption } from "@/components/ui/native-select";
import { createEmergencyFund } from "@/app/(dashboard)/crash-test/actions";
import {
  annuityPayment,
  mortgageRise,
  toneFor,
  unexpectedExpense,
  type Tone,
} from "@/lib/finance/crash-test";
import type { CrashTestData } from "@/lib/data/crash-test";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type ScenarioKey = "job" | "expense" | "mortgage";

const SCENARIOS: { key: ScenarioKey; icon: LucideIcon; title: string; text: string }[] = [
  {
    key: "job",
    icon: BriefcaseBusiness,
    title: "Perdo il lavoro",
    text: "Lo stipendio si ferma, arriva la NASpI",
  },
  {
    key: "expense",
    icon: ReceiptText,
    title: "Una spesa imprevista",
    text: "L'auto, la caldaia, il dentista",
  },
  {
    key: "mortgage",
    icon: House,
    title: "Sale la rata del mutuo",
    text: "Il tasso variabile cresce di qualche punto",
  },
];

const failed = (): ActionResult => ({ ok: false, error: "Operazione non riuscita. Riprova." });

export function CrashView({ data }: { data: CrashTestData }) {
  const [scenario, setScenario] = useState<ScenarioKey>("job");

  return (
    <div className="grid grid-cols-1 gap-8">
      <Baseline data={data} />

      <section aria-labelledby="scenarios-title" className="grid gap-4">
        <h2 id="scenarios-title" className="sr-only">
          Scegli lo scenario
        </h2>
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Scenario"
        >
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={scenario === s.key}
              onClick={() => setScenario(s.key)}
              className={cn(
                "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
                scenario === s.key
                  ? "border-primary bg-primary/5"
                  : "bg-card hover:border-foreground/30 border-transparent",
              )}
            >
              <s.icon className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span className="grid">
                <span className="font-semibold">{s.title}</span>
                <span className="text-muted-foreground text-sm">{s.text}</span>
              </span>
            </button>
          ))}
        </div>
        {scenario === "job" && <JobPanel data={data} />}
        {scenario === "expense" && <ExpensePanel data={data} />}
        {scenario === "mortgage" && <MortgagePanel data={data} />}
      </section>

      <EmergencyFund data={data} />
      <Notes data={data} />
    </div>
  );
}

function Baseline({ data }: { data: CrashTestData }) {
  const money = useMoney();
  const { baseline } = data;
  const saving = baseline.income - baseline.expense;
  const months =
    data.monthNames.length === 1
      ? data.monthNames[0]
      : `${data.monthNames.slice(0, -1).join(", ")} e ${data.monthNames[data.monthNames.length - 1]}`;

  return (
    <section aria-labelledby="baseline-title" className="bg-card grid gap-4 rounded-2xl border p-5">
      <h2 id="baseline-title" className="flex items-center gap-2 font-medium">
        <Wallet className="size-4" aria-hidden /> Da dove parti
      </h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-sm">Soldi a disposizione oggi</dt>
          <dd className="text-2xl font-semibold tabular-nums">{money(baseline.liquid)}</dd>
          <dd className="text-muted-foreground text-xs">{data.accountNames.join(", ")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">In un mese normale</dt>
          <dd className="tabular-nums">
            entrano <span className="font-semibold">{money(baseline.income)}</span>, escono{" "}
            <span className="font-semibold">{money(baseline.expense)}</span>
          </dd>
          <dd className="text-muted-foreground text-xs tabular-nums">
            di cui {money(baseline.needs)} per le cose necessarie: casa, spesa, trasporti, salute…
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Ogni mese</dt>
          <dd
            className={cn(
              "text-2xl font-semibold tabular-nums",
              saving < 0 && "text-red-700 dark:text-red-400",
            )}
          >
            {saving >= 0 ? `+${money(saving)}` : `−${money(-saving)}`}
          </dd>
          <dd className="text-muted-foreground text-xs">
            {saving >= 0 ? "messi da parte, in media" : "più di quanto entra, in media"}
          </dd>
        </div>
      </dl>
      <p className="text-muted-foreground text-xs">
        Medie di {months}
        {data.shared ? ", per tutto lo spazio" : ""}.{" "}
        {data.hasInvestments && "Gli investimenti non li conto: venderli di fretta può costare. "}
      </p>
    </section>
  );
}

function ExpensePanel({ data }: { data: CrashTestData }) {
  const money = useMoney();
  const whole = useWholeMoney();
  const [preset, setPreset] = useState<number | "other">(1500);
  const [other, setOther] = useState("");
  const amount = preset === "other" ? parseNumber(other) : preset;
  const result = amount && amount > 0 ? unexpectedExpense(data.baseline, amount) : null;
  const saving = data.baseline.income - data.baseline.expense;

  let outcome: ReactNode = null;
  if (result && amount) {
    const covered = result.shortfall === 0;
    const tone: Tone = !covered
      ? "danger"
      : (result.cushion ?? 0) < 1
        ? "warn"
        : toneFor(result.held);
    outcome = (
      <Outcome
        data={data}
        title={covered ? "La copri" : `Mancano ${money(result.shortfall)}`}
        tone={tone}
        projection={result}
        share={{
          scenario: "Se arrivasse una spesa imprevista",
          verdict: covered ? "La copro" : "Non basta",
          detail: covered
            ? "con i soldi che ho da parte."
            : "Ci sto lavorando: prima viene il fondo per gli imprevisti.",
        }}
      >
        {covered ? (
          <p>
            Dopo averla pagata ti restano{" "}
            <strong className="tabular-nums">{money(result.after)}</strong>
            {result.cushion !== null && (
              <>
                , {result.cushion < 1 ? "meno di un mese" : monthsText(result.cushion)} di spese
                normali
              </>
            )}
            .
          </p>
        ) : (
          <p>
            Oggi hai {money(data.baseline.liquid)}: per pagarla servirebbe un prestito, o
            rimandarla.
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          {result.recovery !== null
            ? `Mettendo da parte come adesso (${whole(saving)} al mese), ci vogliono ${result.recovery === 1 ? "un mese" : `${result.recovery} mesi`} per tornare dove sei oggi.`
            : result.held !== null
              ? `E ogni mese esce più di quanto entra: senza cambiare, i soldi finiscono verso ${runOutMonth(data.start, result.held)}.`
              : "E ogni mese esce più di quanto entra: per rimettere i soldi da parte serve prima risparmiare."}
        </p>
      </Outcome>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="bg-card grid content-start gap-4 rounded-2xl border p-5">
        <div>
          <h3 className="font-medium">Quanto costa</h3>
          <p className="text-muted-foreground text-sm">
            Un guasto all&apos;auto, la caldaia, il dentista: arriva tutto insieme e si paga subito.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Importo della spesa">
          {([1500, 5000, "other"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={preset === p}
              onClick={() => setPreset(p)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium tabular-nums",
                preset === p
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {p === "other" ? "Un'altra cifra" : whole(p)}
            </button>
          ))}
        </div>
        {preset === "other" && (
          <FormField
            label="Quanto"
            name="amount"
            inputMode="decimal"
            placeholder="Es. 2.500"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            errors={other && !amount ? ["Scrivi un importo (es. 2.500)"] : undefined}
          />
        )}
      </div>
      {outcome}
    </div>
  );
}

function MortgagePanel({ data }: { data: CrashTestData }) {
  const money = useMoney();
  const usable = data.loans.filter((l) => l.months !== null);
  const initial = usable.find((l) => /mutuo/i.test(l.name))?.id ?? "custom";
  const [loanId, setLoanId] = useState(initial);
  const [points, setPoints] = useState(2);
  const [custom, setCustom] = useState({ balance: "", years: "", rate: "" });

  const debt = data.loans.find((l) => l.id === loanId);
  let loan: { balance: number; rate: number; payment: number; months: number } | null = null;
  let problem: string | null = null;
  if (debt) {
    if (debt.months === null) {
      problem =
        "La rata di questo debito non copre gli interessi: controlla i dati in Piano debiti.";
    } else
      loan = { balance: debt.balance, rate: debt.rate, payment: debt.payment, months: debt.months };
  } else {
    const balance = parseNumber(custom.balance);
    const years = parseNumber(custom.years);
    const rate = custom.rate.trim() === "" ? null : parseNumber(custom.rate);
    if (balance && years && rate !== null && years <= 40) {
      const months = Math.round(years * 12);
      loan = { balance, rate, months, payment: annuityPayment(balance, rate, months) };
    }
  }
  const result = loan ? mortgageRise(data.baseline, loan, points) : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="bg-card grid content-start gap-4 rounded-2xl border p-5">
        <div>
          <h3 className="font-medium">Il mutuo</h3>
          <p className="text-muted-foreground text-sm">
            Vale per il tasso variabile: con il fisso la rata non cambia. Tra il 2022 e il 2023
            l&apos;Euribor è salito di oltre tre punti.
          </p>
        </div>
        <SelectField
          label="Quale"
          name="loan"
          value={loanId}
          onChange={(e) => setLoanId(e.target.value)}
        >
          {data.loans.map((l) => (
            <NativeSelectOption key={l.id} value={l.id}>
              {l.name}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value="custom">
            Un mutuo che non ho in Piano debiti
          </NativeSelectOption>
        </SelectField>
        {loanId === "custom" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <FormField
              label="Residuo (€)"
              name="balance"
              inputMode="decimal"
              placeholder="Es. 120.000"
              value={custom.balance}
              onChange={(e) => setCustom({ ...custom, balance: e.target.value })}
            />
            <FormField
              label="Anni rimasti"
              name="years"
              inputMode="numeric"
              placeholder="Es. 20"
              value={custom.years}
              onChange={(e) => setCustom({ ...custom, years: e.target.value })}
            />
            <FormField
              label="Tasso (%)"
              name="rate"
              inputMode="decimal"
              placeholder="Es. 3,2"
              value={custom.rate}
              onChange={(e) => setCustom({ ...custom, rate: e.target.value })}
            />
          </div>
        ) : (
          debt && (
            <p className="text-muted-foreground text-sm tabular-nums">
              Residuo {money(debt.balance)} al {debt.rate.toLocaleString("it-IT")}%, rata{" "}
              {money(debt.payment)}
              {debt.months !== null &&
                `, ancora ${debt.months >= 24 ? `${Math.round(debt.months / 12)} anni` : `${debt.months} mesi`}`}
              .
            </p>
          )
        )}
        <div className="grid gap-2">
          <p className="text-sm font-medium">Di quanto sale il tasso</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Aumento del tasso">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={points === p}
                onClick={() => setPoints(p)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium",
                  points === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                +{p} {p === 1 ? "punto" : "punti"}
              </button>
            ))}
          </div>
        </div>
        {problem && <p className="text-sm text-(--warn-text)">{problem}</p>}
        {!loan && !problem && (
          <p className="text-muted-foreground text-sm">
            Scrivi residuo, anni e tasso: li uso solo per il calcolo, non li salvo.
          </p>
        )}
      </div>
      {result && loan && (
        <Outcome
          data={data}
          title={
            result.saving >= 0
              ? "Reggi"
              : result.held === null
                ? "Reggi, ma i risparmi calano"
                : `Reggi ${monthsText(result.held)}`
          }
          tone={
            result.saving >= 0
              ? result.saving < 100
                ? "warn"
                : "ok"
              : result.held === null
                ? "warn"
                : toneFor(result.held)
          }
          projection={result}
          share={{
            scenario: `Se la rata del mutuo salisse di ${points} ${points === 1 ? "punto" : "punti"}`,
            verdict: result.held === null ? "Reggo" : monthsText(result.held),
            detail:
              result.held === null
                ? "Ho fatto i conti prima che succeda."
                : "di autonomia. Adesso so quanto mettere da parte.",
          }}
        >
          <p>
            La rata passa da <strong className="tabular-nums">{money(loan.payment)}</strong> a{" "}
            <strong className="tabular-nums">{money(result.payment)}</strong> al mese (+
            {money(result.delta)}).
          </p>
          <p className="text-muted-foreground text-sm">
            {result.saving >= 0
              ? `Ogni mese metteresti da parte ${money(result.saving)} invece di ${money(data.baseline.income - data.baseline.expense)}.`
              : result.held === null
                ? `Ogni mese uscirebbero ${money(-result.saving)} più di quanti ne entrano: i soldi da parte bastano per più di tre anni, ma calano.`
                : `Ogni mese uscirebbero ${money(-result.saving)} più di quanti ne entrano: i soldi finiscono verso ${runOutMonth(data.start, result.held)}.`}
          </p>
        </Outcome>
      )}
    </div>
  );
}

function EmergencyFund({ data }: { data: CrashTestData }) {
  const money = useMoney();
  const [pending, start] = useTransition();
  const { emergency, baseline } = data;
  const goal = emergency.goal;

  const create = () =>
    start(async () => {
      const res = await createEmergencyFund(emergency.target).catch(failed);
      if (res.ok) toast.success("Obiettivo creato: lo trovi in Obiettivi");
      else toast.error(res.error ?? "Operazione non riuscita. Riprova.");
    });

  return (
    <section
      aria-labelledby="emergency-title"
      className="grid gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5"
    >
      <h2 id="emergency-title" className="flex items-center gap-2 font-medium">
        <PiggyBank className="size-4" aria-hidden /> La mossa che regge tutti gli scenari
      </h2>
      {goal ? (
        <>
          <p className="text-sm">
            {data.shared ? "Avete" : "Hai"} già «{goal.name}»:{" "}
            <span className="font-medium tabular-nums">
              {money(goal.current)} di {money(goal.target)}
            </span>
            . Ogni {money(baseline.expense)} che ci {data.shared ? "mettete" : "metti"} è un mese in
            più di autonomia se le cose vanno male.
          </p>
          <Link
            href="/goals"
            className="text-primary inline-flex items-center gap-1 justify-self-start text-sm font-medium hover:underline"
          >
            Alimentalo in Obiettivi <ArrowRight className="size-4" aria-hidden />
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm">
            Un fondo per gli imprevisti di {emergency.months}{" "}
            {emergency.months === 1 ? "mese" : "mesi"} di spese:{" "}
            <span className="font-medium tabular-nums">{money(emergency.target)}</span>. Si
            costruisce un po&apos; alla volta, con una cifra fissa ogni mese: conta più la costanza
            dell&apos;importo.
          </p>
          <Button type="button" onClick={create} disabled={pending} className="justify-self-start">
            {pending ? "Un attimo…" : "Crea l'obiettivo «Fondo emergenza»"}
          </Button>
        </>
      )}
    </section>
  );
}

function Notes({ data }: { data: CrashTestData }) {
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-xs">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        Una simulazione con regole semplificate, non una previsione né una consulenza. Entrate e
        uscite sono le medie degli ultimi mesi; se cambiano, cambia anche il risultato.
        {data.euro &&
          " La NASpI è stimata con i valori INPS del 2026 (circolare n. 4 del 28 gennaio 2026) e l'Irpef 2026, senza addizionali né TFR: l'importo vero lo calcola l'INPS sulla domanda."}{" "}
        FinTrack non vende prodotti finanziari: la risposta a ogni scenario è mettere da parte.
      </span>
    </p>
  );
}
