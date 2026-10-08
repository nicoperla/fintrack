import { requireSpace } from "@/lib/auth/session";
import { getPacts } from "@/lib/data/pacts";
import { PactView } from "@/components/pacts/pact-view";

export const metadata = { title: "Il patto · FinTrack" };

export default async function PactPage() {
  const space = await requireSpace();
  const data = await getPacts(space.user.id, space.id);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Il patto</h1>
        <p className="text-muted-foreground text-sm">
          Un limite di spesa fino a fine mese, una posta e un amico che fa da arbitro. Il verdetto
          lo do io, dai tuoi movimenti.
        </p>
      </div>
      <PactView data={data} />
    </div>
  );
}
