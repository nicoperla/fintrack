import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RadarView } from "@/components/rights/radar-view";
import { requireSpace } from "@/lib/auth/session";
import { getRightsRadar } from "@/lib/data/rights";
import { cn } from "@/lib/utils";

export const metadata = { title: "Radar dei diritti · FinTrack" };

type SearchParams = { anno?: string | string[] };

export default async function RightsRadarPage({ searchParams }: { searchParams: SearchParams }) {
  const space = await requireSpace();
  const data = await getRightsRadar(
    space.user.id,
    space.id,
    typeof searchParams.anno === "string" ? searchParams.anno : undefined,
  );

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
          <h1 className="text-2xl font-semibold tracking-tight">Radar dei diritti</h1>
          <p className="text-muted-foreground text-sm">
            Quello che il 730 precompilato non sa, la detrazione per l&apos;affitto e il welfare
            aziendale da non perdere.
          </p>
        </div>
        {data.years.length > 1 && (
          <nav
            className="bg-muted inline-flex rounded-lg p-1 text-sm"
            aria-label="Anno delle spese"
          >
            {data.years.map((y) => (
              <Link
                key={y}
                href={`/ritrovati/radar?anno=${y}`}
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
      <RadarView data={data} />
    </div>
  );
}
