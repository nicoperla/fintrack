import Link from "next/link";
import { requireSpace } from "@/lib/auth/session";
import { getCrashTest } from "@/lib/data/crash-test";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { CrashView } from "@/components/crash-test/crash-view";

export const metadata = { title: "Il crash test · FinTrack" };

export default async function CrashTestPage() {
  const space = await requireSpace();
  const data = await getCrashTest(space.user.id, space.id);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Il crash test</h1>
        <p className="text-muted-foreground text-sm">
          Che succede se domani perdi il lavoro, arriva una spesa imprevista o sale la rata del
          mutuo? Lo provo sui tuoi numeri e ti dico quanti mesi reggi.
        </p>
      </div>
      {data.hasData ? (
        <CrashView data={data} />
      ) : (
        <EmptyState
          illustration="mountain"
          title="Prima serve un mese di numeri"
          description="Il crash test parte dai soldi che hai sui conti e da un mese normale di entrate e uscite: registra i movimenti di un mese intero e torna qui."
          action={
            <Link href="/transactions" className={buttonVariants()}>
              Vai ai movimenti
            </Link>
          }
        />
      )}
    </div>
  );
}
