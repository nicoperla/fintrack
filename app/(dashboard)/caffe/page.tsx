import Link from "next/link";
import { requireSpace } from "@/lib/auth/session";
import { getMoneyTalk } from "@/lib/data/money-talk";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { TalkView } from "@/components/money-talk/talk-view";

export const metadata = { title: "Il caffè dei conti · FinTrack" };

type SearchParams = { month?: string | string[] };

export default async function MoneyTalkPage({ searchParams }: { searchParams: SearchParams }) {
  const space = await requireSpace();
  const memberCount = space.spaces.find((s) => s.id === space.id)?.memberCount ?? 1;
  const month = typeof searchParams.month === "string" ? searchParams.month : undefined;
  const data = memberCount >= 2 ? await getMoneyTalk(space.id, month) : null;

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Il caffè dei conti</h1>
        <p className="text-muted-foreground text-sm">
          Una volta al mese, un quarto d&apos;ora insieme: com&apos;è andato il mese comune, chi ha
          messo cosa, gli obiettivi, una decisione e una cosa da festeggiare.
        </p>
      </div>
      {memberCount < 2 ? (
        <EmptyState
          illustration="celebrate"
          title="Il caffè dei conti si fa in due (o più)"
          description="Invita il partner o chi vive con te nello spazio: ogni mese FinTrack vi prepara l'agenda con i vostri numeri, e voi vi sedete a parlarne."
          action={
            <Link href="/settings" className={buttonVariants()}>
              Invita qualcuno
            </Link>
          }
        />
      ) : !data ? (
        <EmptyState
          illustration="receipts"
          title="Prima, qualche movimento"
          description="Registrate le spese del mese, ognuno le sue: quando il mese finisce, il primo caffè è pronto."
        />
      ) : data.early ? (
        <EmptyState
          illustration="calendar"
          title={`Il primo caffè, a inizio ${data.nextTalk ?? data.nextMonthName}`}
          description={`Quando ${data.nextMonthName} sarà finito, FinTrack prepara l'agenda con i vostri numeri. Intanto registrate le spese, ognuno le sue.`}
        />
      ) : (
        <TalkView key={data.month} data={data} />
      )}
    </div>
  );
}
