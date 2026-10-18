import { IseeView } from "@/components/tax/isee-view";
import { requireSpace } from "@/lib/auth/session";
import { getIsee } from "@/lib/data/isee";

export const metadata = { title: "ISEE e bonus · Orbitly" };

export default async function IseePage() {
  const space = await requireSpace();
  const data = await getIsee(space.user.id, space.id);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ISEE e bonus</h1>
        <p className="text-muted-foreground text-sm">
          Quando rinnovare l&apos;ISEE, i numeri dei conti che chiede la DSU e i bonus a cui
          potresti avere diritto.
        </p>
      </div>
      <IseeView data={data} />
    </div>
  );
}
