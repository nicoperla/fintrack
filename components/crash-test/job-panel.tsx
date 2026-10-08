"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { monthsText, Outcome, parseNumber, runOutMonth } from "@/components/crash-test/outcome";
import { saveCrashProfile } from "@/app/(dashboard)/crash-test/actions";
import {
  jobLoss,
  monthsWorkedSince,
  naspiEstimate,
  NASPI,
  toneFor,
  WORK_KINDS,
  WORK_LABELS,
  type NaspiEstimate,
  type WorkKind,
} from "@/lib/finance/crash-test";
import type { CrashTestData } from "@/lib/data/crash-test";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const failed = (): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." });
const typed = (n: number) =>
  n.toLocaleString("it-IT", {
    maximumFractionDigits: 0,
    useGrouping: "always",
  } as Intl.NumberFormatOptions);

/** "24 mesi", "4 mesi e mezzo". */
const durationText = (months: number) => {
  const whole = Math.floor(months);
  const half = months - whole >= 0.5 ? " e mezzo" : "";
  return whole === 0 ? "mezzo mese" : `${whole} ${whole === 1 ? "mese" : "mesi"}${half}`;
};

function NaspiNote({ naspi }: { naspi: NaspiEstimate }) {
  const money = useMoney();
  if (!naspi.eligible) {
    return (
      <p className="text-sm text-(--warn-text)">
        Con meno di 13 settimane di contributi negli ultimi quattro anni la NASpI non spetta.
      </p>
    );
  }
  return (
    <div className="bg-muted/40 grid gap-1 rounded-xl p-3 text-sm">
      <p>
        <span className="font-medium">NASpI stimata:</span>{" "}
        <span className="tabular-nums">{money(naspi.gross)}</span> lordi, circa{" "}
        <span className="font-medium tabular-nums">{money(naspi.net)}</span> al mese dopo
        l&apos;Irpef, per {durationText(naspi.months)}.
      </p>
      <p className="text-muted-foreground text-xs">
        {naspi.capped && `È il massimo del ${NASPI.year}. `}
        {naspi.fullMonths + 1 === 8 ? "Dall'8°" : `Dal ${naspi.fullMonths + 1}°`} mese cala del 3%
        al mese. Spetta se il lavoro finisce senza che tu lo voglia (licenziamento, contratto
        scaduto) o per dimissioni per giusta causa, e va chiesta all&apos;INPS entro 68 giorni.
      </p>
    </div>
  );
}

/** Losing the job: the salary stops, the NASpI comes in, the other incomes of the space stay. */
export function JobPanel({ data }: { data: CrashTestData }) {
  const money = useMoney();
  const { job, baseline } = data;
  const saved = {
    work: (job.work ?? "employee") as WorkKind,
    ral: job.ral ? typed(job.ral) : "",
    since: job.since ?? "",
    birthYear: job.birthYear ? String(job.birthYear) : "",
  };
  const [form, setForm] = useState(saved);
  const [salaryText, setSalaryText] = useState(job.salary ? typed(Math.round(job.salary)) : "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const errors = result?.fieldErrors;
  const dirty = (Object.keys(saved) as (keyof typeof saved)[]).some((k) => saved[k] !== form[k]);

  const salary = parseNumber(salaryText);
  const ral = parseNumber(form.ral);
  const birthYear = Number(form.birthYear);
  const age = form.birthYear && Number.isInteger(birthYear) ? data.today.year - birthYear : null;
  const employee = form.work === "employee";
  const naspi =
    employee && data.euro && ral && form.since
      ? naspiEstimate({ ral, monthsWorked: monthsWorkedSince(form.since, data.today), age })
      : null;
  const counted = naspi?.eligible ? naspi : null;

  async function save() {
    setPending(true);
    const res = await saveCrashProfile(form).catch(failed);
    setPending(false);
    setResult(res.ok ? null : res);
    if (res.ok) toast.success("Fatto: la prossima volta li trovi già qui");
  }

  let outcome = null;
  if (form.work !== "other" && salary !== null) {
    const main = jobLoss(baseline, { salary, naspi: counted, cutWants: false });
    const cut = jobLoss(baseline, { salary, naspi: counted, cutWants: true });
    const kept = Math.max(0, baseline.income - salary);
    outcome = (
      <Outcome
        data={data}
        title={main.held === null ? "Reggi più di 3 anni" : `Reggi ${monthsText(main.held)}`}
        tone={toneFor(main.held)}
        projection={main}
        share={{
          scenario: "Se perdessi il lavoro",
          verdict: main.held === null ? "Reggo" : monthsText(main.held),
          detail:
            main.held === null
              ? "più di tre anni, con quello che ho da parte."
              : "di autonomia. Adesso so quanto mettere da parte.",
        }}
      >
        <p>
          {counted ? "Con la NASpI" : "Senza NASpI"}
          {main.held === null
            ? " e spendendo come adesso, i soldi da parte bastano oltre tre anni."
            : `, spendendo come adesso: i soldi finiscono verso ${runOutMonth(data.start, main.held)}.`}
        </p>
        {baseline.needs < baseline.expense && (
          <p className="text-sm">
            Tenendo solo le spese necessarie ({money(baseline.needs)} al mese invece di{" "}
            {money(baseline.expense)}):{" "}
            <strong>{cut.held === null ? "più di 3 anni" : monthsText(cut.held)}</strong>.
          </p>
        )}
        {data.shared && kept > 0 && (
          <p className="text-muted-foreground text-sm">
            Le altre entrate dello spazio, {money(kept)} al mese, continuano ad arrivare.
          </p>
        )}
      </Outcome>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="bg-card grid content-start gap-4 rounded-2xl border p-5">
        <div>
          <h3 className="font-medium">Il tuo lavoro</h3>
          <p className="text-muted-foreground text-sm">
            {data.shared
              ? "Lo scenario è tuo: lo stipendio che si ferma è il tuo, le entrate degli altri restano."
              : "Lo stipendio si ferma dal mese prossimo; le spese restano quelle di sempre."}
          </p>
        </div>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Che lavoro fai</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Che lavoro fai">
            {WORK_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={form.work === k}
                onClick={() => setForm({ ...form, work: k })}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium",
                  form.work === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {WORK_LABELS[k]}
              </button>
            ))}
          </div>
        </fieldset>

        {form.work === "other" ? (
          <p className="text-muted-foreground text-sm">
            Senza uno stipendio questo scenario non fa per te: prova gli altri due.
          </p>
        ) : (
          <>
            <FormField
              label="Stipendio netto che perderesti, al mese"
              name="salary"
              inputMode="decimal"
              placeholder="Es. 1.600"
              value={salaryText}
              onChange={(e) => setSalaryText(e.target.value)}
              hint={
                job.salarySource === "settings"
                  ? "Quello che hai scritto nelle impostazioni. Qui lo cambi solo per la prova."
                  : job.salarySource === "estimated"
                    ? "Stimato dalle entrate che hai registrato negli ultimi mesi."
                    : undefined
              }
              errors={salaryText && salary === null ? ["Scrivi un importo (es. 1.600)"] : undefined}
            />
            {employee ? (
              <>
                <FormField
                  label="RAL, lo stipendio lordo dell'anno"
                  name="ral"
                  inputMode="decimal"
                  placeholder="Es. 28.000"
                  value={form.ral}
                  onChange={(e) => setForm({ ...form, ral: e.target.value })}
                  errors={errors?.ral}
                  hint={
                    job.ralEstimate && !form.ral
                      ? `È nel contratto o nella busta paga. Dallo stipendio netto la stimo intorno a ${typed(job.ralEstimate)} €.`
                      : "È nel contratto o nella busta paga."
                  }
                />
                {job.ralEstimate && !form.ral && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="-mt-2 justify-self-start"
                    onClick={() => setForm({ ...form, ral: typed(job.ralEstimate!) })}
                  >
                    Usa la stima
                  </Button>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <FormField
                    label="Lavori con i contributi da"
                    name="since"
                    type="month"
                    max={`${data.today.year}-${String(data.today.month + 1).padStart(2, "0")}`}
                    value={form.since}
                    onChange={(e) => setForm({ ...form, since: e.target.value })}
                    errors={errors?.since}
                    hint="Senza interruzioni. Contano gli ultimi 4 anni."
                  />
                  <FormField
                    label="Anno di nascita (facoltativo)"
                    name="birthYear"
                    inputMode="numeric"
                    placeholder="Es. 1985"
                    value={form.birthYear}
                    onChange={(e) => setForm({ ...form, birthYear: e.target.value })}
                    errors={errors?.birthYear}
                    hint="Dai 55 anni la NASpI cala più tardi."
                  />
                </div>
                {!data.euro ? (
                  <p className="text-muted-foreground text-sm">
                    La NASpI la stimo solo per gli spazi in euro.
                  </p>
                ) : naspi ? (
                  <NaspiNote naspi={naspi} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Scrivi la RAL e da quando lavori: senza, il conto è senza NASpI.
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Con la partita IVA la NASpI non c&apos;è. Chi ha una collaborazione può avere la
                DIS-COLL, con regole sue: qui non la conto.
              </p>
            )}
            {salary === null && !salaryText && (
              <p className="text-muted-foreground text-sm">
                Scrivi quanto ti entra al mese di stipendio netto per vedere il risultato.
              </p>
            )}
          </>
        )}
        {dirty && (
          <Button
            type="button"
            variant="outline"
            onClick={save}
            disabled={pending}
            className="justify-self-start"
          >
            {pending ? "Salvataggio…" : "Ricorda questi dati"}
          </Button>
        )}
      </div>
      {outcome}
    </div>
  );
}
