import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, PiggyBank, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AnimatedCurrency } from "@/components/dashboard/animated-currency";
import { StatTile } from "@/components/dashboard/stat-tile";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { getBudgetsWithSpending } from "@/lib/data/budgets";
import { getGoals } from "@/lib/data/goals";
import { BudgetsOverview, GoalsOverview } from "@/components/dashboard/planning-overview";

export const metadata = { title: "Dashboard · FinTrack" };

const percent = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0 });

export default async function DashboardPage() {
  const user = await requireUser();
  const firstName = user.name?.split(" ")[0];
  const [data, budgets, goals] = await Promise.all([
    getDashboardData(user.id),
    getBudgetsWithSpending(user.id),
    getGoals(user.id),
  ]);

  const greeting = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Ciao{firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="text-muted-foreground text-sm">{data.monthLabel}</p>
    </div>
  );

  if (data.accountCount === 0) {
    return (
      <div className="grid grid-cols-1 gap-8">
        {greeting}
        <EmptyState
          icon={Wallet}
          title="Iniziamo dai tuoi conti"
          description="Aggiungi il conto corrente, una carta o i contanti: da qui vedrai saldo, entrate, uscite e dove vanno i tuoi soldi."
          action={
            <Link href="/accounts" className={buttonVariants()}>
              Aggiungi un conto
            </Link>
          }
        />
      </div>
    );
  }

  const { income, expense } = data.current;
  const saved = income - expense;
  const previousLabel = `lo stesso periodo di ${data.previousMonthName}`;

  return (
    <div className="grid grid-cols-1 gap-6">
      {greeting}

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
