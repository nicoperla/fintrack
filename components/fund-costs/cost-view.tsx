"use client";

import { useMemo, useState, type FormEvent } from "react";
import { FileSearch, HelpCircle, Pencil, ScanSearch, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMoney, useWholeMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelectOption } from "@/components/ui/native-select";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { CostChart } from "@/components/fund-costs/cost-chart";
import { deleteFundCosts, saveFundCosts } from "@/app/(dashboard)/investments/costi/actions";
import {
  advisorQuestions,
  compareWithCategory,
  ESMA_REFERENCE,
  FUND_CATEGORIES,
  FUND_CATEGORY_INFO,
  projectCosts,
  yearlyCost,
  type FundCategory,
} from "@/lib/finance/fund-costs";
import type { FundCostAccount, FundCostsPage } from "@/lib/data/fund-costs";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const RETURNS = [2, 3, 5] as const;
const failed = (): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." });
const pct = (n: number) =>
  `${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}%`;
const typed = (n: number) =>
  n === 0 ? "" : n.toLocaleString("it-IT", { maximumFractionDigits: 3, useGrouping: false });
/** "un terzo", "il 18%": what share of the money the costs take. */
const shareText = (share: number) => {
  if (Math.abs(share - 1 / 3) < 0.02) return "un terzo";
  if (Math.abs(share - 1 / 2) < 0.02) return "metà";
  if (Math.abs(share - 1 / 4) < 0.015) return "un quarto";
  return `il ${Math.round(share * 100)}%`;
};

export function CostView({ data }: { data: FundCostsPage }) {
  const [grossReturn, setGrossReturn] = useState<number>(3);
  const [editing, setEditing] = useState<FundCostAccount | null>(null);

  return (
    <div className="grid grid-cols-1 gap-8">
      <section className="bg-card grid gap-4 rounded-2xl border p-5" aria-labelledby="kid-how">
        <h2 id="kid-how" className="flex items-center gap-2 font-medium">
          <FileSearch className="size-4" aria-hidden /> Dove trovi i costi
        </h2>
        <p className="text-muted-foreground text-sm">
          Nel KID, il documento di tre pagine che la banca deve darti prima di farti firmare (lo
          trovi anche sul sito di chi gestisce il prodotto, cercando il codice ISIN). Alla voce
          «Quali sono i costi?», nella tabella «Composizione dei costi»: costi di ingresso e di
          uscita, costi di gestione, costi di transazione, commissioni di performance.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Rendimento ipotetico, prima dei costi:</span>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Rendimento ipotetico">
            {RETURNS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={grossReturn === r}
                onClick={() => setGrossReturn(r)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium tabular-nums",
                  grossReturn === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {r}% l&apos;anno
              </button>
            ))}
          </div>
        </div>
        <p className="text-muted-foreground -mt-2 text-xs">
          Uguale per tutti i prodotti e non è una previsione: serve solo a vedere quanto pesano i
          costi.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6">
        {data.accounts.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            grossReturn={grossReturn}
            onEdit={() => setEditing(a)}
          />
        ))}
      </div>

      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Non è una consulenza: FinTrack non ti dice se tenere un prodotto, venderlo o comprarne un
          altro. Mostra quanto pesano negli anni i costi scritti nel KID, accanto alla media della
          categoria. Medie dei costi correnti dei fondi UCITS venduti nell&apos;UE,{" "}
          {ESMA_REFERENCE.period}:{" "}
          <a
            href={ESMA_REFERENCE.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {ESMA_REFERENCE.source}
          </a>
          . Per scegliere, parlane con un consulente abilitato.
        </span>
      </p>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          {editing && <CostForm account={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountCard({
  account: a,
  grossReturn,
  onEdit,
}: {
  account: FundCostAccount;
  grossReturn: number;
  onEdit: () => void;
}) {
  const money = useMoney();
  const whole = useWholeMoney();
  const [confirm, setConfirm] = useState(false);
  const c = a.costs;
  const monthly = c?.monthly ?? a.usualMonthly;

  const result = useMemo(() => {
    if (!c) return null;
    const projection = projectCosts({ value: a.value, monthly, grossReturn, costs: c });
    const comparison = compareWithCategory(c, c.category);
    const reference = comparison
      ? projectCosts({
          value: a.value,
          monthly,
          grossReturn,
          costs: { ...c, ongoing: comparison.reference, transaction: 0, performance: 0 },
        })
      : null;
    return { projection, comparison, reference };
  }, [c, a.value, monthly, grossReturn]);

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">{a.name}</h2>
        <p className="text-muted-foreground text-sm">
          {c && c.category !== "other" ? `${FUND_CATEGORY_INFO[c.category].label} · ` : ""}vale{" "}
          <span className="tabular-nums">{money(a.value, a.currency)}</span>
          {a.stale && " (valore da aggiornare)"}
          {monthly > 0 && (
            <>
              , più <span className="tabular-nums">{money(monthly, a.currency)}</span> al mese
            </>
          )}
        </p>
      </div>
      {c && (
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            <Pencil /> Modifica
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setConfirm(true)}
            aria-label={`Togli i costi di ${a.name}`}
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </div>
  );

  if (!c || !result) {
    return (
      <article className="bg-card grid gap-4 rounded-2xl border p-5">
        {header}
        <p className="text-muted-foreground text-sm">
          Scrivi i costi dal KID: ti mostro quanto ti costano in euro tra 10, 20 e 30 anni.
        </p>
        <Button type="button" onClick={onEdit} className="justify-self-start">
          <ScanSearch /> Inserisci i costi dal KID
        </Button>
      </article>
    );
  }

  const { projection, comparison, reference } = result;
  const twenty = projection.byHorizon[1];
  const refTwenty = reference?.byHorizon[1];

  return (
    <article className="bg-card grid gap-5 rounded-2xl border p-5">
      {header}
      <ul className="flex flex-wrap gap-2 text-xs">
        <li className="bg-muted rounded-full px-3 py-1 font-medium">
          Costi ogni anno {pct(yearlyCost(c))}
        </li>
        {c.entry > 0 && (
          <li className="bg-muted rounded-full px-3 py-1">Ingresso {pct(c.entry)}</li>
        )}
        {c.exit > 0 && <li className="bg-muted rounded-full px-3 py-1">Uscita {pct(c.exit)}</li>}
        {c.performance > 0 && (
          <li className="bg-muted rounded-full px-3 py-1">
            di cui performance {pct(c.performance)}
          </li>
        )}
      </ul>

      <div className="grid gap-1">
        <p className="text-2xl font-semibold tracking-tight">
          In 20 anni i costi si portano via{" "}
          <span className="tabular-nums">{whole(twenty.cost)}</span>
        </p>
        <p className="text-muted-foreground text-sm">
          {shareText(twenty.share)} di quello che avresti senza costi, con un rendimento del{" "}
          {grossReturn}% l&apos;anno. Ogni anno sembra poco: è l&apos;interesse composto che lavora
          al contrario.
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {projection.byHorizon.map((h) => (
          <div key={h.years} className="bg-muted/40 rounded-xl p-3">
            <dt className="text-muted-foreground text-xs">In {h.years} anni</dt>
            <dd className="text-lg font-semibold tabular-nums">{whole(h.cost)}</dd>
            <dd className="text-muted-foreground text-xs">{Math.round(h.share * 100)}% in meno</dd>
          </div>
        ))}
      </dl>

      {comparison ? (
        <p
          className={cn(
            "rounded-xl p-3 text-sm",
            comparison.verdict === "above"
              ? "bg-amber-500/10 text-(--warn-text)"
              : comparison.verdict === "below"
                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "bg-muted/50",
          )}
        >
          Il costo medio {FUND_CATEGORY_INFO[c.category].plural} venduti nell&apos;UE è{" "}
          {pct(comparison.reference)} l&apos;anno: questo costa{" "}
          {comparison.verdict === "above"
            ? "di più"
            : comparison.verdict === "below"
              ? "di meno"
              : "più o meno uguale"}
          .
          {refTwenty && comparison.verdict !== "inline" && (
            <>
              {" "}
              Con il costo medio, in 20 anni i costi sarebbero{" "}
              <span className="tabular-nums">{whole(refTwenty.cost)}</span>.
            </>
          )}
        </p>
      ) : (
        <p className="bg-muted/50 rounded-xl p-3 text-sm">
          Per polizze d&apos;investimento e fondi pensione qui non ho una media pubblica
          confrontabile: per i fondi pensione la COVIP pubblica l&apos;indicatore sintetico dei
          costi (ISC).
        </p>
      )}

      <CostChart
        gross={projection.gross}
        net={projection.net}
        reference={reference?.net ?? null}
        currency={a.currency}
      />
      <p className="text-muted-foreground -mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-(--viz-other)" /> Senza costi
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-(--viz-expense)" /> Con i suoi costi
        </span>
        {reference && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-(--viz-income)" /> Con il costo
            medio della categoria
          </span>
        )}
      </p>

      <details className="group rounded-xl border p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <HelpCircle className="size-4" aria-hidden /> Domande da fare a chi te l&apos;ha venduto
        </summary>
        <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-sm">
          {advisorQuestions(c, c.category).map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">
          Se l&apos;hai comprato in banca, ogni anno deve mandarti il rendiconto di costi e oneri: è
          lì che controlli se i numeri tornano.
        </p>
      </details>

      <ConfirmDeleteDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Togliere i costi?"
        description={`I costi di «${a.name}» spariscono dalla radiografia. Il conto e i suoi valori restano.`}
        successMessage="Costi tolti"
        onConfirm={() => deleteFundCosts(a.id)}
        confirmLabel="Togli"
      />
    </article>
  );
}

function CostForm({ account, onDone }: { account: FundCostAccount; onDone: () => void }) {
  const whole = useWholeMoney();
  const c = account.costs;
  const [form, setForm] = useState({
    category: (c?.category ?? "") as FundCategory | "",
    ongoing: c ? typed(c.ongoing) : "",
    transaction: c ? typed(c.transaction) : "",
    performance: c ? typed(c.performance) : "",
    entry: c ? typed(c.entry) : "",
    exit: c ? typed(c.exit) : "",
    monthly: c?.monthly ? String(c.monthly).replace(".", ",") : "",
  });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const errors = result?.fieldErrors;
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await saveFundCosts({ accountId: account.id, ...form }).catch(failed);
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success("Costi salvati: ecco quanto pesano");
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>I costi di «{account.name}»</DialogTitle>
        <DialogDescription>
          Copiali dalla tabella «Composizione dei costi» del KID, come percentuali. Se una voce non
          c&apos;è, lasciala vuota.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <SelectField
          label="Che prodotto è"
          name="category"
          value={form.category}
          onChange={set("category")}
          errors={errors?.category}
          hint="Serve per il confronto con la media della categoria."
        >
          <NativeSelectOption value="">Scegli</NativeSelectOption>
          {FUND_CATEGORIES.map((k) => (
            <NativeSelectOption key={k} value={k}>
              {FUND_CATEGORY_INFO[k].label}
            </NativeSelectOption>
          ))}
        </SelectField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Costi di gestione e altri costi (% l'anno)"
            name="ongoing"
            inputMode="decimal"
            placeholder="Es. 1,85"
            value={form.ongoing}
            onChange={set("ongoing")}
            errors={errors?.ongoing}
            hint="«Commissioni di gestione e altri costi amministrativi o di esercizio»."
          />
          <FormField
            label="Costi di transazione (% l'anno)"
            name="transaction"
            inputMode="decimal"
            placeholder="Es. 0,15"
            value={form.transaction}
            onChange={set("transaction")}
            errors={errors?.transaction}
          />
          <FormField
            label="Costi di ingresso (%)"
            name="entry"
            inputMode="decimal"
            placeholder="Es. 2"
            value={form.entry}
            onChange={set("entry")}
            errors={errors?.entry}
            hint="Si pagano su ogni versamento."
          />
          <FormField
            label="Costi di uscita (%)"
            name="exit"
            inputMode="decimal"
            placeholder="Es. 0"
            value={form.exit}
            onChange={set("exit")}
            errors={errors?.exit}
          />
          <FormField
            label="Commissioni di performance (% l'anno)"
            name="performance"
            inputMode="decimal"
            placeholder="Se ci sono"
            value={form.performance}
            onChange={set("performance")}
            errors={errors?.performance}
          />
          <FormField
            label="Versamento al mese (facoltativo)"
            name="monthly"
            inputMode="decimal"
            placeholder={
              account.usualMonthly > 0 ? String(Math.round(account.usualMonthly)) : "Es. 200"
            }
            value={form.monthly}
            onChange={set("monthly")}
            errors={errors?.monthly}
            hint={
              account.usualMonthly > 0
                ? `Vuoto: uso la media degli ultimi 12 mesi, ${whole(account.usualMonthly)}.`
                : "Vuoto: nessun versamento."
            }
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvataggio…" : "Mostra quanto costano"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
