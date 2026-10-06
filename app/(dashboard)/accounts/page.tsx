import Link from "next/link";
import { ChevronRight, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { GainBadge } from "@/components/investments/investment-bits";
import { requireSpace } from "@/lib/auth/session";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { getInvestments } from "@/lib/data/investments";
import { isInvestment } from "@/lib/account-types";
import { toAccountDTO } from "@/lib/dto";
import { Amount } from "@/components/amount";

export const metadata = { title: "Conti · FinTrack" };

export default async function AccountsPage() {
  const space = await requireSpace();
  const [accounts, investments] = await Promise.all([
    getAccountsWithBalances(space.id),
    getInvestments(space.id),
  ]);
  // Two families: the money you can spend, and the investments (valued apart).
  const spendable = accounts.filter((a) => !isInvestment(a.type));
  const investing = accounts.filter((a) => isInvestment(a.type));
  const available = spendable.reduce((sum, a) => sum + a.baseBalance, 0);
  const position = new Map(investments.accounts.map((a) => [a.id, a]));

  const newAccountButton = (
    <Button>
      <Plus data-icon="inline-start" />
      Nuovo conto
    </Button>
  );

  return (
    <div className="grid grid-cols-1 gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conti</h1>
          {accounts.length > 0 && (
            <p className="text-muted-foreground text-sm">
              Soldi disponibili{" "}
              <span className="text-foreground font-medium tabular-nums">
                <Amount value={available} />
              </span>
              {investments.total && (
                <>
                  {" "}
                  · investimenti{" "}
                  <span className="text-foreground font-medium tabular-nums">
                    <Amount value={investments.total.value} />
                  </span>
                </>
              )}
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
        <>
          <section aria-labelledby="spendable-title" className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="spendable-title" className="font-medium">
                Per spendere
              </h2>
              <p className="text-muted-foreground text-sm">
                Conti, carte, contanti e risparmi:{" "}
                <span className="text-foreground font-medium tabular-nums">
                  <Amount value={available} />
                </span>
              </p>
            </div>
            {spendable.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {spendable.map((account) => (
                  <AccountCard key={account.id} account={toAccountDTO(account)} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nessun conto per le spese: aggiungi il conto corrente o i contanti.
              </p>
            )}
          </section>

          <section aria-labelledby="investments-title" className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="investments-title" className="flex items-center gap-2 font-medium">
                <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-300" aria-hidden />
                Investimenti
              </h2>
              {investments.total && (
                <Link
                  href="/investments"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
                >
                  <span className="text-foreground font-medium tabular-nums">
                    <Amount value={investments.total.value} />
                  </span>
                  <GainBadge gain={investments.total.gain} pct={investments.total.gainPct} />
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              )}
            </div>
            {investing.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {investing.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={toAccountDTO(account)}
                    investment={position.get(account.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-card/50 text-muted-foreground flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4 text-sm">
                <p className="max-w-xl">
                  Conto titoli, ETF, fondo pensione? Crea un conto di tipo «Investimenti»: resta
                  fuori dai soldi disponibili e ne segui valore e rendimento a parte.
                </p>
                <AccountFormDialog
                  defaultType="INVESTMENT"
                  trigger={
                    <Button variant="outline" size="sm">
                      <Plus data-icon="inline-start" />
                      Conto investimenti
                    </Button>
                  }
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
