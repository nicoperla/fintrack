import { InsightList } from "@/components/analytics/insight-list";
import { CashFlowSankey } from "@/components/analytics/cash-flow-sankey";
import { NetWorthChart } from "@/components/analytics/net-worth-chart";
import { SpendingHeatmap } from "@/components/analytics/spending-heatmap";
import { requireUser } from "@/lib/auth/session";
import {
  getCashFlow,
  getInsights,
  getNetWorth,
  getSpendingHeatmap,
  NET_WORTH_RANGES,
  type NetWorthRange,
} from "@/lib/data/analytics";

export const metadata = { title: "Analisi · FinTrack" };

type SearchParams = { month?: string | string[]; range?: string | string[] };

const single = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function InsightsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const monthParam = single(searchParams.month);
  const rangeParam = single(searchParams.range);
  const range: NetWorthRange =
    rangeParam && rangeParam in NET_WORTH_RANGES ? (rangeParam as NetWorthRange) : "3m";

  const [insights, flow, heatmap, netWorth] = await Promise.all([
    getInsights(user.id),
    getCashFlow(user.id, monthParam),
    getSpendingHeatmap(user.id),
    getNetWorth(user.id, range),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analisi</h1>
        <p className="text-muted-foreground text-sm">
          Cosa raccontano i tuoi movimenti: confronti, flussi e abitudini di spesa.
        </p>
      </div>

      <section aria-labelledby="insights-title" className="grid gap-3">
        <h2 id="insights-title" className="font-medium">
          Insight del mese
        </h2>
        <InsightList insights={insights} />
      </section>

      <CashFlowSankey flow={flow} query={{ range }} />
      <NetWorthChart data={netWorth} range={range} query={{ month: flow.month }} />
      <SpendingHeatmap data={heatmap} />
    </div>
  );
}
