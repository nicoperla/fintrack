import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { TrueSalaryView } from "@/components/true-salary/true-salary-view";
import { requireSpace } from "@/lib/auth/session";
import { getLastYearAmounts, getTrueSalary } from "@/lib/data/true-salary";

export const metadata = { title: "Stipendio vero · FinTrack" };

export default async function TrueSalaryPage() {
  const space = await requireSpace();
  const [data, lastYear] = await Promise.all([
    getTrueSalary(space.id),
    getLastYearAmounts(space.id),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lo stipendio vero</h1>
        <p className="text-muted-foreground text-sm">
          Quanto puoi spendere fino al prossimo stipendio, con le stangate dell&apos;anno già messe
          da parte.
        </p>
      </div>
      {data ? (
        <TrueSalaryView data={data} lastYear={lastYear} />
      ) : (
        <EmptyState
          illustration="wallet"
          title="Serve un conto di tutti i giorni"
          description="Lo stipendio vero si calcola sui soldi che usi ogni giorno: aggiungi il conto corrente, la carta o i contanti."
          action={
            <Link href="/accounts" className={buttonVariants()}>
              Vai ai conti
            </Link>
          }
        />
      )}
    </div>
  );
}
