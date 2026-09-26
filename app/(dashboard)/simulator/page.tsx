import { SavingsSimulator } from "@/components/planning/savings-simulator";
import { requireSpace } from "@/lib/auth/session";
import { getSimulatorDefaults } from "@/lib/data/intelligence";

export const metadata = { title: "Simulatore · FinTrack" };

export default async function SimulatorPage() {
  const space = await requireSpace();
  const defaults = await getSimulatorDefaults(space.id);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simulatore “e se…?”</h1>
        <p className="text-muted-foreground text-sm">
          Guarda come cambia il tuo futuro risparmiando un po&apos; di più ogni mese.
        </p>
      </div>
      <SavingsSimulator {...defaults} />
      <p className="text-muted-foreground text-xs">
        Proiezione indicativa con capitalizzazione mensile e rendimento costante: non è una
        consulenza finanziaria.
      </p>
    </div>
  );
}
