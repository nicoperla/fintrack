import Link from "next/link";
import { My730View } from "@/components/tax/my730-view";
import { requireSpace } from "@/lib/auth/session";
import { getMy730 } from "@/lib/data/my730";
import { getCoupleView } from "@/lib/data/my730-couple";
import { taxRoom } from "@/lib/tax/simulate";
import { cn } from "@/lib/utils";

export const metadata = { title: "Il mio 730 · Orbitly" };

type SearchParams = { anno?: string | string[] };

export default async function My730Page({ searchParams }: { searchParams: SearchParams }) {
  const space = await requireSpace();
  const data = await getMy730(
    space.user.id,
    space.id,
    typeof searchParams.anno === "string" ? searchParams.anno : undefined,
  );
  const couple = data.shared
    ? await getCoupleView({
        userId: space.user.id,
        householdId: space.id,
        year: data.year,
        myRoom: taxRoom(data.cu, data.situation, data.rules),
        myExpenses: data.simulation?.expensesDeduction ?? 0,
        share: data.shareCapacity,
      })
    : null;

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Il mio 730</h1>
          <p className="text-muted-foreground text-sm">
            Il tuo 730 passo dopo passo: cosa preparare, se puoi fare da solo, cosa portare al CAF e
            quando arrivano i soldi.
          </p>
        </div>
        {data.years.length > 1 && (
          <nav
            className="bg-muted inline-flex rounded-lg p-1 text-sm"
            aria-label="Anno dei redditi"
          >
            {data.years.map((y) => (
              <Link
                key={y}
                href={`/730?anno=${y}`}
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
      <My730View data={data} couple={couple} />
    </div>
  );
}
