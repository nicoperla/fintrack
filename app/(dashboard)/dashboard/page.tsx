import { Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Dashboard · FinTrack" };

export default async function DashboardPage() {
  const user = await requireUser();
  const firstName = user.name?.split(" ")[0];

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Ciao{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-muted-foreground">Ecco la tua panoramica.</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <Wallet className="text-muted-foreground size-6" />
        </div>
        <h2 className="font-medium">La tua dashboard è pronta</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Qui vedrai saldo totale, entrate e uscite del mese e l&apos;andamento degli ultimi mesi.
        </p>
      </div>
    </div>
  );
}
