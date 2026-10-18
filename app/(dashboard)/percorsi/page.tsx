import { JourneysView } from "@/components/journeys/journeys-view";
import { requireSpace } from "@/lib/auth/session";
import { getJourneys } from "@/lib/data/journeys";

export const metadata = { title: "Percorsi e scadenze · Orbitly" };

export default async function JourneysPage() {
  const space = await requireSpace();
  const data = await getJourneys(space.user.id);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Percorsi e scadenze</h1>
        <p className="text-muted-foreground text-sm">
          Quando la vita cambia, cosa fare con soldi e pratiche, passo dopo passo. E i documenti da
          rinnovare prima che scadano.
        </p>
      </div>
      <JourneysView data={data} />
    </div>
  );
}
