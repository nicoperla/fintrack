import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { NewClaimForm } from "@/components/claims/new-claim-form";
import { CLAIMS_DISCLAIMER, StatusBadge } from "@/components/claims/claim-ui";
import { requireSpace } from "@/lib/auth/session";
import { getClaimPrefill, getClaimsOverview } from "@/lib/data/claims";
import { KIND_LABELS, isOpenClaim } from "@/lib/finance/claims";

export const metadata = { title: "Nuova pratica · FinTrack" };

type SearchParams = {
  ritrovato?: string | string[];
  movimento?: string | string[];
  tipo?: string | string[];
};
const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

export default async function NewClaimPage({ searchParams }: { searchParams: SearchParams }) {
  const space = await requireSpace();
  const [prefill, overview] = await Promise.all([
    getClaimPrefill(space.id, {
      ritrovato: one(searchParams.ritrovato),
      movimento: one(searchParams.movimento),
      tipo: one(searchParams.tipo),
    }),
    getClaimsOverview(space.user.id, space.id),
  ]);
  if (prefill && "existingId" in prefill) redirect(`/ritrovati/pratiche/${prefill.existingId}`);
  const inProgress = overview.claims.find((c) => isOpenClaim(c.status));
  // A charge can be contested more than once (the shop first, then the bank): just say so.
  const contested = prefill?.transaction
    ? overview.claims.find((c) => c.transaction?.id === prefill.transaction?.id)
    : undefined;

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <Link
          href="/ritrovati/pratiche"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Le tue pratiche
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nuova pratica</h1>
        <p className="text-muted-foreground text-sm">
          {prefill?.source ??
            "Scegli cosa vuoi ottenere: la lettera la preparo io, con le norme giuste."}
        </p>
      </div>
      {prefill ? (
        <section className="bg-card grid gap-4 rounded-2xl border p-5">
          {contested && (
            <p className="bg-muted/40 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border p-3 text-sm">
              <StatusBadge status={contested.status} />
              Su questo movimento hai già aperto una pratica (
              {KIND_LABELS[contested.kind].toLowerCase()}).
              <Link
                href={`/ritrovati/pratiche/${contested.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                Vai alla pratica
              </Link>
            </p>
          )}
          <NewClaimForm
            prefill={prefill}
            canOpen={overview.canOpen}
            openClaimId={inProgress?.id ?? null}
          />
        </section>
      ) : (
        <EmptyState
          illustration="search"
          title="Non lo trovo più"
          description="Il movimento o il ritrovamento da cui partivi non c'è più: forse è stato modificato o eliminato. Puoi comunque aprire una pratica scrivendo tu i dati."
          action={
            <Link href="/ritrovati/pratiche/nuova" className={buttonVariants()}>
              Apri una pratica vuota
            </Link>
          }
        />
      )}
      <p className="text-muted-foreground text-xs">{CLAIMS_DISCLAIMER}</p>
    </div>
  );
}
