import { Landmark, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { DebtPlanner } from "@/components/planning/debt-planner";
import { DebtFormDialog } from "@/components/planning/debt-form-dialog";
import { requireUser } from "@/lib/auth/session";
import { getDebts } from "@/lib/data/intelligence";

export const metadata = { title: "Piano debiti · FinTrack" };

export default async function DebtsPage() {
  const user = await requireUser();
  const debts = await getDebts(user.id);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Piano di rientro dai debiti</h1>
        <p className="text-muted-foreground text-sm">
          Confronta le strategie «valanga» e «palla di neve» e scopri quando sarai libero dai
          debiti.
        </p>
      </div>
      {debts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Nessun debito da pianificare"
          description="Aggiungi prestiti, finanziamenti o carte revolving con tasso e rata minima: ti mostriamo la strada più veloce ed economica per chiuderli."
          action={
            <DebtFormDialog
              trigger={
                <Button>
                  <Plus data-icon="inline-start" />
                  Aggiungi un debito
                </Button>
              }
            />
          }
        />
      ) : (
        <DebtPlanner debts={debts} />
      )}
      <p className="text-muted-foreground text-xs">
        Simulazione con interessi mensili al TAN indicato e rate costanti: le date reali possono
        variare. Non è una consulenza finanziaria.
      </p>
    </div>
  );
}
