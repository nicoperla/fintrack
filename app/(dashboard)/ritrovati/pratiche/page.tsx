import Link from "next/link";
import { ArrowLeft, Lock, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ClaimsBoard } from "@/components/claims/claims-board";
import { requireSpace } from "@/lib/auth/session";
import { getClaimsOverview } from "@/lib/data/claims";

export const metadata = { title: "Riprenditeli · FinTrack" };

export default async function ClaimsPage() {
  const space = await requireSpace();
  const overview = await getClaimsOverview(space.user.id, space.id);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/ritrovati"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" aria-hidden /> Soldi ritrovati
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Riprenditeli</h1>
          <p className="text-muted-foreground text-sm">
            Le pratiche per riavere i tuoi soldi: la lettera è pronta, le scadenze le conto io.
          </p>
        </div>
        {overview.canOpen ? (
          <Link href="/ritrovati/pratiche/nuova" className={buttonVariants()}>
            <Plus /> Nuova pratica
          </Link>
        ) : (
          <Link href="/settings#abbonamento" className={buttonVariants({ variant: "outline" })}>
            <Lock /> Più pratiche con Pro
          </Link>
        )}
      </div>
      <ClaimsBoard overview={overview} />
    </div>
  );
}
