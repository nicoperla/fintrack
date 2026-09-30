import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, PiggyBank } from "lucide-react";
import { AnimatedCurrency } from "@/components/dashboard/animated-currency";
import { WorkTimeNote } from "@/components/dashboard/work-time-note";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { getForecast } from "@/lib/data/forecast";
import { getCoachData } from "@/lib/data/coach";
import { getLatestStoryMonth } from "@/lib/data/stories";
import { CoachTeaser, StoryBubble } from "@/components/dashboard/coach-teaser";
import { StatTile } from "@/components/dashboard/stat-tile";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { requireSpace } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { getBudgetsWithSpending } from "@/lib/data/budgets";
import { getGoals } from "@/lib/data/goals";
import { getInsights } from "@/lib/data/analytics";
import { getGamification } from "@/lib/data/gamification";
import { ProgressChips } from "@/components/gamification/progress-chips";
import { BadgeCelebration } from "@/components/gamification/badge-celebration";
import { InsightList } from "@/components/analytics/insight-list";
import { QuickEntry } from "@/components/quick-entry/quick-entry";
import { Onboarding } from "@/components/onboarding/onboarding";
import { getQuickEntryContext } from "@/lib/data/intelligence";
import { getAccountOptions } from "@/lib/data/accounts";
import { getCategoryTree } from "@/lib/data/categories";
import { toCategoryOptions } from "@/lib/dto";
import { BudgetsOverview, GoalsOverview } from "@/components/dashboard/planning-overview";

export const metadata = { title: "Dashboard · FinTrack" };

const percent = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0 });

export default async function DashboardPage() {
  const space = await requireSpace();
  const { user } = space;
  const firstName = user.name?.split(" ")[0];
  const [
    data,
    budgets,
    goals,
    insights,
    gamification,
    quickContext,
    accountOptions,
    tree,
    forecast,
    coach,
    storyMonth,
  ] = await Promise.all([
    getDashboardData(space.id),
    getBudgetsWithSpending(space.id),
    getGoals(space.id),
    getInsights(space.id),
    getGamification(space.user.id, space.id),
    getQuickEntryContext(space.id),
    getAccountOptions(space.id),
    getCategoryTree(space.id),
    getForecast(space.id),
    getCoachData(space.user.id, space.id),
    getLatestStoryMonth(space.id),
  ]);

  const greeting = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Ciao{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm">{data.monthLabel}</p>
      </div>
      {storyMonth && <StoryBubble monthKey={storyMonth.key} monthName={storyMonth.name} />}
      <ProgressChips data={gamification} />
      <BadgeCelebration
        unlocked={gamification.badges
          .filter((b) => b.unlocked)
          .map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );

  if (data.accountCount === 0) {
    return (
      <Onboarding name={user.name ?? null} hasCategories={quickContext.categories.length > 0} />
    );
  }

  const { income, expense } = data.current;
  const saved = income - expense;
  const previousLabel = `lo stesso periodo di ${data.previousMonthName}`;

  return (
    <div className="grid grid-cols-1 gap-6">
      {greeting}

      <QuickEntry
        context={quickContext}
        accounts={accountOptions}
        categories={toCategoryOptions([...tree.expense, ...tree.income])}
      />

      <section
        className="bg-card relative overflow-hidden rounded-2xl border p-6"
        aria-label="Patrimonio"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--viz-income), transparent 70%)" }}
        />
        <p className="text-muted-foreground text-sm">Patrimonio netto</p>
        <AnimatedCurrency
          value={data.netWorth}
          className="mt-1 block text-5xl font-semibold tracking-tight sm:text-6xl"
        />
        <Link
          href="/accounts"
          className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1 text-sm"
        >
          Somma di {data.accountCount === 1 ? "1 conto" : `${data.accountCount} conti`}
          <ChevronRight className="size-4" />
        </Link>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label={`Entrate di ${data.monthName}`}
          icon={ArrowDownLeft}
          value={income}
          previous={data.previousSamePeriod.income}
          previousLabel={previousLabel}
          upIsGood
        />
        <StatTile
          label={`Uscite di ${data.monthName}`}
          icon={ArrowUpRight}
          value={expense}
          previous={data.previousSamePeriod.expense}
          previousLabel={previousLabel}
          upIsGood={false}
          extra={<WorkTimeNote amount={expense} />}
        />
        <StatTile
          label="Saldo del mese"
          icon={PiggyBank}
          value={saved}
          footnote={
            income > 0 ? (
              <span>
                {saved >= 0
                  ? `Hai messo da parte il ${percent.format(saved / income)} delle entrate`
                  : "Finora le uscite superano le entrate"}
              </span>
            ) : (
              <span>Entrate meno uscite: nessuna entrata ancora registrata</span>
            )
          }
        />
      </div>

      {coach.report.hasData && <CoachTeaser report={coach.report} />}

      {forecast && <ForecastCard data={forecast} />}

      {insights.length > 0 && (
        <section aria-labelledby="dash-insights" className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 id="dash-insights" className="font-medium">
              Insight del mese
            </h2>
            <Link
              href="/insights"
              className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-sm"
            >
              Analisi completa
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <InsightList insights={insights} limit={3} />
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <TrendChart data={data.trend} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <CategoryDonut
            slices={data.categories}
            monthName={data.monthName}
            range={data.monthRange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BudgetsOverview budgets={budgets} />
        <GoalsOverview goals={goals} />
      </div>
    </div>
  );
}
