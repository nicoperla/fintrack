import { ArrowLeftRight, Plus, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Amount } from "@/components/amount";
import { EmptyState } from "@/components/empty-state";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { AnimatedCurrency } from "@/components/dashboard/animated-currency";
import { AllocationBar, GainBadge } from "@/components/investments/investment-bits";
import { InvestmentChart } from "@/components/investments/investment-chart";
import { InvestmentAccountCard } from "@/components/investments/investment-account-card";
import { requireSpace } from "@/lib/auth/session";
import { getInvestments, STALE_AFTER_DAYS } from "@/lib/data/investments";
import { downsample } from "@/lib/finance/investments";

export const metadata = { title: "Investimenti · FinTrack" };

const STEPS = [
  {
    icon: Wallet,
    title: "Un conto per ogni investimento",
    text: "Conto titoli, ETF, fondo pensione, crypto: crea un conto di tipo «Investimenti». Resta fuori dai soldi disponibili.",
  },
  {
    icon: ArrowLeftRight,
    title: "I versamenti sono trasferimenti",
    text: "Quando metti soldi da parte, registra un trasferimento dal conto corrente: è quello che hai versato, non una spesa.",
  },
  {
    icon: RefreshCw,
    title: "Ogni tanto aggiorna il valore",
    text: `Copia il valore dall'app della banca o del broker, anche una volta al mese: FinTrack calcola guadagno o perdita. Dopo ${STALE_AFTER_DAYS} giorni te lo ricordo.`,
  },
];

export default async function InvestmentsPage() {
  const space = await requireSpace();
  const data = await getInvestments(space.id);

  const newInvestmentButton = (
    <Button>
      <Plus data-icon="inline-start" />
      Nuovo conto investimenti
    </Button>
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investimenti</h1>
          <p className="text-muted-foreground text-sm">
            Quanto valgono i tuoi investimenti, separati dai soldi che puoi spendere.
          </p>
        </div>
        {data.total && <AccountFormDialog defaultType="INVESTMENT" trigger={newInvestmentButton} />}
      </div>

      {!data.total ? (
        <EmptyState
          illustration="chart"
          title="Tieni gli investimenti a parte"
          description="Crea un conto di tipo «Investimenti»: non entrerà nei soldi disponibili e qui vedrai quanto vale, quanto hai versato e quanto stai guadagnando. Hai già un conto con degli investimenti? Modificalo dalla pagina Conti e scegli il tipo «Investimenti»."
          action={<AccountFormDialog defaultType="INVESTMENT" trigger={newInvestmentButton} />}
        />
      ) : (
        <>
          <section
            aria-label="Totale investimenti"
            className="bg-card relative overflow-hidden rounded-2xl border p-6 sm:p-8"
          >
            <span
              aria-hidden
              className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.22),transparent_65%)]"
            />
            <div className="relative grid gap-2">
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <TrendingUp className="size-4" aria-hidden />
                </span>
                Valore di oggi ·{" "}
                {data.accounts.length === 1 ? "1 conto" : `${data.accounts.length} conti`}
              </p>
              <AnimatedCurrency
                value={data.total.value}
                className="app-number font-display block text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl"
              />
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <GainBadge gain={data.total.gain} pct={data.total.gainPct} />
                <span className="text-muted-foreground text-sm">
                  su <Amount value={data.total.invested} /> versati in tutto
                </span>
              </p>
              {data.staleCount > 0 && (
                <p className="text-sm text-(--warn-text)">
                  {data.staleCount === 1
                    ? "Un conto ha il valore da aggiornare: lo trovi qui sotto."
                    : `${data.staleCount} conti hanno il valore da aggiornare: li trovi qui sotto.`}
                </p>
              )}
            </div>
            {data.accounts.length > 1 && (
              <AllocationBar slices={data.accounts} className="relative mt-6" />
            )}
          </section>

          {data.series.length > 1 && <InvestmentChart series={downsample(data.series, 400)} />}

          <div className="grid gap-4 md:grid-cols-2">
            {data.accounts.map((account) => (
              <InvestmentAccountCard key={account.id} account={account} />
            ))}
          </div>

          <section
            aria-labelledby="how-title"
            className="bg-card grid gap-4 rounded-2xl border p-5"
          >
            <h2 id="how-title" className="font-medium">
              Come funziona
            </h2>
            <ol className="grid gap-4 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="grid content-start gap-1.5 text-sm">
                  <span className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span className="bg-muted text-foreground flex size-6 items-center justify-center rounded-full font-medium">
                      {i + 1}
                    </span>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="font-medium">{title}</span>
                  <span className="text-muted-foreground">{text}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
