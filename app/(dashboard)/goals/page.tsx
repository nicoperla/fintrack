import { Flag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { GoalCard } from "@/components/planning/goal-card";
import { GoalFormDialog } from "@/components/planning/goal-dialogs";
import { requireUser } from "@/lib/auth/session";
import { getGoals } from "@/lib/data/goals";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Obiettivi · FinTrack" };

export default async function GoalsPage() {
  const user = await requireUser();
  const goals = await getGoals(user.id);

  const active = goals.filter((g) => !g.completed);
  const saved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const monthly = active.reduce((sum, g) => sum + (g.suggestedMonthly ?? 0), 0);

  const newButton = (
    <Button>
      <Plus data-icon="inline-start" />
      Nuovo obiettivo
    </Button>
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Obiettivi</h1>
          {goals.length > 0 && (
            <p className="text-muted-foreground text-sm">
              Hai messo da parte{" "}
              <span className="text-foreground font-medium">{formatCurrency(saved)}</span>
              {monthly > 0 && (
                <>
                  {" "}
                  · per restare nei tempi servono{" "}
                  <span className="text-foreground font-medium">{formatCurrency(monthly)}</span> al
                  mese
                </>
              )}
            </p>
          )}
        </div>
        {goals.length > 0 && <GoalFormDialog trigger={newButton} />}
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Per cosa stai risparmiando?"
          description="Una vacanza, un fondo emergenza, un nuovo computer: crea un obiettivo e ti diciamo quanto mettere da parte ogni mese."
          action={<GoalFormDialog trigger={newButton} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  );
}
