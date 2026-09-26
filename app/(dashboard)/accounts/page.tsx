import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { requireSpace } from "@/lib/auth/session";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { toAccountDTO } from "@/lib/dto";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Conti · FinTrack" };

export default async function AccountsPage() {
  const space = await requireSpace();
  const accounts = await getAccountsWithBalances(space.id);
  const total = accounts.reduce((sum, a) => sum + a.baseBalance, 0);

  const newAccountButton = (
    <Button>
      <Plus data-icon="inline-start" />
      Nuovo conto
    </Button>
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conti</h1>
          {accounts.length > 0 && (
            <p className="text-muted-foreground text-sm">
              Saldo complessivo{" "}
              <span className="text-foreground font-medium tabular-nums">
                {formatCurrency(total, space.currency)}
              </span>
            </p>
          )}
        </div>
        {accounts.length > 0 && <AccountFormDialog trigger={newAccountButton} />}
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          illustration="wallet"
          title="Aggiungi il tuo primo conto"
          description="Conto corrente, carta, contanti o risparmi: crea i conti che usi per iniziare a registrare i movimenti."
          action={<AccountFormDialog trigger={newAccountButton} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={toAccountDTO(account)} />
          ))}
        </div>
      )}
    </div>
  );
}
