"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChoiceCard, Stepper, TaxSection, TONE_BOX } from "@/components/tax/ui";
import { parseAmount } from "@/lib/finance/money";
import {
  EMPTY_ISEE_INPUT,
  ISEE_ESTIMATE_CHECKED_AT,
  estimateIsee,
  type IseeInput,
} from "@/lib/tax/isee-estimate";
import type { IseeData } from "@/lib/data/isee";
import { cn } from "@/lib/utils";

const toText = (n: number) => (n > 0 ? String(Math.round(n)) : "");
const num = (text: string) => Number(parseAmount(text) ?? 0) || 0;

type Money =
  | "income"
  | "employmentIncome"
  | "pensionIncome"
  | "rent"
  | "savings"
  | "stateBonds"
  | "homeRendita"
  | "homeMortgage"
  | "otherProperty";

/** What Orbitly already knows of the savings: for accounts the higher of balance and average. */
function savingsFrom(data: IseeData) {
  const year =
    data.years.find((y) => y.year === data.baseYear) ?? data.years[data.years.length - 1];
  if (!year?.accounts) return 0;
  return year.accounts
    .filter((a) => a.currency === "EUR")
    .reduce(
      (s, a) => s + Math.max(0, a.type === "INVESTMENT" ? a.end : Math.max(a.end, a.average)),
      0,
    );
}

/**
 * "Stima il tuo ISEE": a few figures, two estimates (the ordinary ISEE and the one for family
 * benefits from 2026), and a button to use them in "Trova bonus". Nothing is saved.
 */
export function IseeEstimateCard({
  data,
  onUse,
}: {
  data: IseeData;
  onUse: (estimate: { ordinary: number; family: number }) => void;
}) {
  const money = useMoney();
  const start = data.estimateStart;
  const children = data.hints.children;
  const [input, setInput] = useState<IseeInput>({
    ...EMPTY_ISEE_INPUT,
    people: Math.max(1, 1 + children),
    children,
    minorChildren: children > 0,
    income: start.employmentIncome + start.pensionIncome + start.otherIncome,
    employmentIncome: start.employmentIncome,
    employees: start.employmentIncome > 0 ? 1 : 0,
    pensionIncome: start.pensionIncome,
    pensioners: start.pensionIncome > 0 ? 1 : 0,
    savings: Math.round(savingsFrom(data)),
  });
  const [texts, setTexts] = useState<Record<Money, string>>({
    income: toText(input.income),
    employmentIncome: toText(input.employmentIncome),
    pensionIncome: toText(input.pensionIncome),
    rent: "",
    savings: toText(input.savings),
    stateBonds: "",
    homeRendita: "",
    homeMortgage: "",
    otherProperty: "",
  });
  const set = (patch: Partial<IseeInput>) => setInput((prev) => ({ ...prev, ...patch }));
  const setMoney = (key: Money, text: string) => {
    setTexts((prev) => ({ ...prev, [key]: text }));
    set({ [key]: num(text) } as Partial<IseeInput>);
  };
  const result = estimateIsee(input);

  const field = (key: Money, label: string, hint?: string) => (
    <label className="grid content-start gap-1 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Input
        inputMode="decimal"
        placeholder="0"
        value={texts[key]}
        onChange={(e) => setMoney(key, e.target.value)}
      />
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </label>
  );

  return (
    <TaxSection
      id="stima-isee"
      icon={Calculator}
      title="Stima il tuo ISEE"
      subtitle={`Prima della DSU: con redditi e risparmi del ${data.baseYear} ti dico più o meno quanto viene, e quali bonus provare.`}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["people", "Persone in famiglia", 12, 1],
            ["children", "Figli", 10, 0],
            ["disabled", "Con disabilità", 6, 0],
          ] as const
        ).map(([key, label, max, min]) => (
          <div
            key={key}
            className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
          >
            <span className="font-medium">{label}</span>
            <Stepper
              value={input[key]}
              onChange={(v) => set({ [key]: Math.max(min, v) } as Partial<IseeInput>)}
              max={max}
              label={label}
            />
          </div>
        ))}
      </div>
      {input.children > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          <ChoiceCard
            type="checkbox"
            name="minorChildren"
            checked={input.minorChildren}
            onChange={(on) => set({ minorChildren: on, childUnder3: on && input.childUnder3 })}
            label="Almeno un figlio minorenne"
          />
          <ChoiceCard
            type="checkbox"
            name="childUnder3"
            checked={input.childUnder3}
            onChange={(on) => set({ childUnder3: on, minorChildren: on || input.minorChildren })}
            label="Un figlio sotto i 3 anni"
          />
          <ChoiceCard
            type="checkbox"
            name="parentsWorking"
            checked={input.parentsWorking}
            onChange={(on) => set({ parentsWorking: on })}
            label="I genitori hanno lavorato almeno 6 mesi"
            hint="Tutti e due, o l'unico genitore."
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {field(
          "income",
          `Redditi di tutta la famiglia nel ${data.baseYear}`,
          "Il reddito complessivo di ognuno, sommato (dalle CU o dai 730).",
        )}
        {field("employmentIncome", "Di cui da lavoro dipendente")}
        <div className="flex items-end justify-between gap-3 rounded-xl border p-3 text-sm">
          <span className="text-muted-foreground text-xs">Quante persone lavorano</span>
          <Stepper
            value={input.employees}
            onChange={(employees) => set({ employees })}
            max={8}
            label="Persone che lavorano"
          />
        </div>
        {field("pensionIncome", "Di cui da pensione")}
        <div className="flex items-end justify-between gap-3 rounded-xl border p-3 text-sm">
          <span className="text-muted-foreground text-xs">Quante persone in pensione</span>
          <Stepper
            value={input.pensioners}
            onChange={(pensioners) => set({ pensioners })}
            max={8}
            label="Persone in pensione"
          />
        </div>
        {field("rent", `Affitto pagato nel ${data.baseYear}`, "Si toglie fino a 7.000 €.")}
        {field(
          "savings",
          "Conti, depositi e investimenti",
          "Per i conti conta il più alto tra saldo al 31/12 e giacenza media: l'ho messo io dai tuoi conti.",
        )}
        {field("stateBonds", "BTP, BOT e buoni postali", "Esclusi fino a 50.000 €.")}
        {field("otherProperty", "Altri immobili (valore IMU, meno i mutui)")}
        {field(
          "homeRendita",
          "Rendita catastale della casa dove vivi",
          start.homeOwned
            ? "La trovi nella visura o nell'atto. Lascia vuoto se sei in affitto."
            : "Lascia vuoto se non è tua.",
        )}
        {field("homeMortgage", "Mutuo che resta sulla casa al 31/12")}
        <ChoiceCard
          type="checkbox"
          name="metroCapital"
          checked={input.metroCapital}
          onChange={(on) => set({ metroCapital: on })}
          label="Vivo in un grande capoluogo"
          hint="Roma, Milano, Napoli, Torino, Palermo, Genova, Bologna, Firenze, Bari, Catania, Venezia, Messina, Reggio Calabria, Cagliari, Sassari."
        />
      </div>

      <div
        className={cn("grid gap-3 rounded-xl border p-4 sm:grid-cols-2", TONE_BOX.info)}
        aria-live="polite"
      >
        <div>
          <p className="text-muted-foreground text-xs">ISEE ordinario, circa</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {money(result.ordinary.isee)}
          </p>
          <p className="text-muted-foreground text-xs">
            Bonus bollette, carta acquisti, tasse universitarie e gli altri.
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">
            ISEE per Assegno unico, nido e nuovi nati, circa
          </p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {money(result.family.isee)}
          </p>
          <p className="text-muted-foreground text-xs">
            Dal 2026 anche Assegno di inclusione: la casa pesa meno, i figli di più.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onUse({ ordinary: result.ordinary.isee, family: result.family.isee });
              document.getElementById("bonus")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Usa queste stime nei bonus
          </Button>
          <span className="text-muted-foreground text-xs">
            Scala di equivalenza {result.ordinary.scale.toLocaleString("it-IT")} (
            {result.family.scale.toLocaleString("it-IT")} per le prestazioni familiari).
          </span>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Stima indicativa con le regole verificate a {ISEE_ESTIMATE_CHECKED_AT}: non conta il
        rendimento figurativo dei risparmi né le spese per la disabilità, e la casa si valuta dalla
        rendita. L&apos;ISEE vero lo calcola l&apos;INPS dalla DSU; sul suo sito c&apos;è anche un
        simulatore ufficiale. Quello che scrivi qui non viene salvato.
      </p>
    </TaxSection>
  );
}
