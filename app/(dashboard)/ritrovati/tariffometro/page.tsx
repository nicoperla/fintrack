import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TariffView } from "@/components/tariffs/tariff-view";
import { requireSpace } from "@/lib/auth/session";
import { getTariffometro } from "@/lib/data/tariffs";

export const metadata = { title: "Il Tariffometro · FinTrack" };

export default async function TariffometroPage() {
  const space = await requireSpace();
  const data = await getTariffometro(space.id);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <Link
          href="/ritrovati"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Soldi ritrovati
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Il Tariffometro</h1>
        <p className="text-muted-foreground text-sm">
          RC auto, conto corrente e luce: quanto paghi tu contro quanto pagano gli altri, con i dati
          pubblici di IVASS, Banca d&apos;Italia e ARERA. E come pagare meno.
        </p>
      </div>
      <TariffView data={data} />
    </div>
  );
}
