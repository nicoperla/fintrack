import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JourneyView } from "@/components/journeys/journey-view";
import { requireSpace } from "@/lib/auth/session";
import { getJourney } from "@/lib/data/journeys";
import { journeyByKey } from "@/lib/journeys/catalog";

export function generateMetadata({ params }: { params: { key: string } }) {
  const journey = journeyByKey(params.key);
  return { title: `${journey?.title ?? "Percorso"} · Orbitly` };
}

export default async function JourneyPage({ params }: { params: { key: string } }) {
  const space = await requireSpace();
  const data = await getJourney(space.user.id, params.key);
  if (!data) notFound();

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <Link
          href="/percorsi"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Percorsi e scadenze
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{data.journey.title}</h1>
      </div>
      <JourneyView data={data} />
    </div>
  );
}
