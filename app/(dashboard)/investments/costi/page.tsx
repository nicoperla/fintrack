import Link from "next/link";
import { requireSpace } from "@/lib/auth/session";
import { getFundCosts } from "@/lib/data/fund-costs";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { CostView } from "@/components/fund-costs/cost-view";

export const metadata = { title: "Radiografia dei costi · FinTrack" };

export default async function FundCostsPage() {
  const space = await requireSpace();
  const data = await getFundCosts(space.id);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/investments" className="hover:underline">
            Investimenti
          </Link>{" "}
          ›
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Radiografia dei costi</h1>
        <p className="text-muted-foreground text-sm">
          L&apos;1,8% l&apos;anno sembra niente. Qui vedi quanti euro ti costa in 10, 20 e 30 anni.
        </p>
      </div>
      {data.accounts.length === 0 ? (
        <EmptyState
          illustration="chart"
          title="Prima un conto investimenti"
          description="Crea un conto di tipo «Investimenti» per il fondo, la polizza o l'ETF: poi qui inserisci i costi scritti nel suo KID."
          action={
            <Link href="/investments" className={buttonVariants()}>
              Vai agli investimenti
            </Link>
          }
        />
      ) : (
        <CostView data={data} />
      )}
    </div>
  );
}
