import { ScanSearch } from "lucide-react";
import { requireSpace } from "@/lib/auth/session";
import { getCoachData } from "@/lib/data/coach";
import { getQuickEntryContext } from "@/lib/data/intelligence";
import { getCoachAccess, PROVIDER_NAMES } from "@/lib/coach/access";
import { EmptyState } from "@/components/empty-state";
import {
  CoachChallenge,
  CoachCuts,
  CoachPlan,
  CoachScore,
  CoachTips,
} from "@/components/coach/coach-overview";
import { AffordCard, type AffordData } from "@/components/coach/afford-card";
import { CoachChat } from "@/components/coach/coach-chat";
import { CoachSetup, CoachStyleButton } from "@/components/coach/coach-style";

export const metadata = { title: "Coach · FinTrack" };

const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString("it-IT")} ${n === 1 ? one : many}`;

export default async function CoachPage() {
  const space = await requireSpace();
  const [data, quickContext, access] = await Promise.all([
    getCoachData(space.user.id, space.id),
    getQuickEntryContext(space.id),
    getCoachAccess(space.user.id),
  ]);
  const { report, input, stats } = data;
  const provider = access.status === "off" ? null : access.provider;

  const afford: AffordData = {
    forecast: data.forecast,
    savingsBalance: input.savingsBalance,
    monthlySaved: report.averages.saved,
    goals: data.goals,
    budgetFor: data.budgetFor,
    quickContext,
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Il tuo coach</h1>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <ScanSearch className="size-4 shrink-0" aria-hidden />
            Ho analizzato {count(stats.transactions, "movimento", "movimenti")},{" "}
            {count(stats.categories, "categoria", "categorie")} e{" "}
            {count(stats.accounts, "conto", "conti")}.
          </p>
        </div>
        {data.configured && (
          <CoachStyleButton profile={data.profile} categories={data.expenseCategories} />
        )}
      </div>

      {!data.configured && (
        <CoachSetup profile={data.profile} categories={data.expenseCategories} />
      )}

      {!report.hasData ? (
        <EmptyState
          illustration="chart"
          title="Mi servono un po' di movimenti"
          description="Registra entrate e spese per qualche giorno: poi ti dico come stai andando e dove puoi migliorare."
        />
      ) : (
        <>
          <CoachScore report={report} />
          <AffordCard data={afford} />

          {report.tips.length > 0 && (
            <section aria-labelledby="tips-title" className="grid gap-3">
              <h2 id="tips-title" className="font-medium">
                I miei consigli per te
              </h2>
              <CoachTips tips={report.tips} />
            </section>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CoachPlan plan={report.plan} />
            <div className="grid content-start gap-4">
              <CoachCuts report={report} />
              <CoachChallenge challenge={report.challenge} />
            </div>
          </div>

          <CoachChat
            access={{
              status: access.status,
              providerName: provider ? PROVIDER_NAMES[provider.id] : null,
            }}
            input={input}
            report={report}
            afford={afford}
          />
        </>
      )}

      <p className="text-muted-foreground text-xs">
        Il coach ti aiuta a gestire il budget: non è un consulente finanziario abilitato e non
        consiglia investimenti specifici.
        {provider &&
          ` Con il coach AI attivo, ogni domanda invia un riepilogo dei tuoi dati a ${PROVIDER_NAMES[provider.id]}, solo per generare la risposta.`}
      </p>
    </div>
  );
}
