import Link from "next/link";
import { requireSpace } from "@/lib/auth/session";
import { getTogether } from "@/lib/data/together";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { TogetherView } from "@/components/together/together-view";

export const metadata = { title: "Mio, tuo, nostro · FinTrack" };

export default async function TogetherPage() {
  const space = await requireSpace();
  const memberCount = space.spaces.find((s) => s.id === space.id)?.memberCount ?? 1;

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mio, tuo, nostro</h1>
        <p className="text-muted-foreground text-sm">
          Il nostro è di tutti e due. Il mio resta mio: dell&apos;altro vedi solo quello che sceglie
          di mostrarti.
        </p>
      </div>
      {memberCount < 2 ? (
        <EmptyState
          illustration="celebrate"
          title="Qui serve uno spazio condiviso"
          description="Il nostro nasce quando inviti il partner o chi vive con te. Ognuno tiene il suo spazio personale e decide cosa mostrarne: un saldo, quanto mette da parte, i propri obiettivi."
          action={
            <Link href="/settings" className={buttonVariants()}>
              Invita qualcuno
            </Link>
          }
        />
      ) : (
        <TogetherView data={await getTogether(space.user.id, space.id)} />
      )}
    </div>
  );
}
