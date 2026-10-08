import Link from "next/link";
import { Coffee } from "lucide-react";
import { requireSpace } from "@/lib/auth/session";
import { getSplit } from "@/lib/data/split";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { SplitView } from "@/components/split/split-view";

export const metadata = { title: "Conti chiari · FinTrack" };

export default async function SplitPage() {
  const space = await requireSpace();
  const memberCount = space.spaces.find((s) => s.id === space.id)?.memberCount ?? 1;

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conti chiari</h1>
          <p className="text-muted-foreground text-sm">
            Chi ha pagato cosa per le spese comuni, e quanto deve ciascuno per essere pari.
          </p>
        </div>
        {memberCount >= 2 && (
          <Link
            href="/caffe"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
          >
            <Coffee className="size-4" aria-hidden /> Il caffè dei conti
          </Link>
        )}
      </div>
      {memberCount < 2 ? (
        <EmptyState
          illustration="celebrate"
          title="Qui si fanno i conti in due (o più)"
          description="Invita il partner o chi vive con te nello spazio: FinTrack terrà il conto di chi paga cosa e vi dirà chi deve quanto, a metà o in base alle entrate."
          action={
            <Link href="/settings" className={buttonVariants()}>
              Invita qualcuno
            </Link>
          }
        />
      ) : (
        <SplitView data={await getSplit(space.id)} currentUserId={space.user.id} />
      )}
    </div>
  );
}
