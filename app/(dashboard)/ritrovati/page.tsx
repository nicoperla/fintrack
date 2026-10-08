import Link from "next/link";
import { requireSpace } from "@/lib/auth/session";
import { getFoundMoney } from "@/lib/data/found-money";
import { claimMarks, getClaimsOverview } from "@/lib/data/claims";
import { getTariffometro } from "@/lib/data/tariffs";
import { FoundMoneyView } from "@/components/found-money/found-money-view";
import { cn } from "@/lib/utils";

export const metadata = { title: "Soldi ritrovati · FinTrack" };

type SearchParams = { anno?: string | string[] };

export default async function FoundMoneyPage({ searchParams }: { searchParams: SearchParams }) {
  const space = await requireSpace();
  const [data, claims, tariffs] = await Promise.all([
    getFoundMoney(
      space.user.id,
      space.id,
      typeof searchParams.anno === "string" ? searchParams.anno : undefined,
    ),
    getClaimsOverview(space.user.id, space.id),
    getTariffometro(space.id),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Soldi ritrovati</h1>
          <p className="text-muted-foreground text-sm">
            Rimborsi del 730, doppi addebiti, abbonamenti e commissioni: i soldi che puoi
            recuperare, trovati nei tuoi movimenti.
          </p>
        </div>
        {data.years.length > 1 && (
          <nav className="bg-muted inline-flex rounded-lg p-1 text-sm" aria-label="Anno">
            {data.years.map((y) => (
              <Link
                key={y}
                href={`/ritrovati?anno=${y}`}
                aria-current={y === data.year ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1",
                  y === data.year ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                )}
              >
                {y}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <FoundMoneyView
        data={data}
        claims={{ marks: claimMarks(claims.claims), totals: claims.totals }}
        tariffs={{
          compared: tariffs.summary.compared,
          above: tariffs.summary.above.length,
          overPerYear: tariffs.summary.overPerYear,
        }}
      />
    </div>
  );
}
