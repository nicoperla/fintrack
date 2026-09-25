import Link from "next/link";
import { Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { NewTransactionButton } from "@/components/transactions/new-transaction-button";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionList } from "@/components/transactions/transaction-list";
import { Pagination } from "@/components/transactions/pagination";
import { requireUser } from "@/lib/auth/session";
import { getAccountOptions } from "@/lib/data/accounts";
import { getCategoryTree } from "@/lib/data/categories";
import { listTransactions } from "@/lib/data/transactions";
import { toCategoryOptions, toTransactionDTO } from "@/lib/dto";
import { formatCurrency } from "@/lib/format";
import { transactionFiltersSchema } from "@/lib/validations/finance";
import { QuickEntry } from "@/components/quick-entry/quick-entry";
import { getQuickEntryContext } from "@/lib/data/intelligence";

export const metadata = { title: "Transazioni · FinTrack" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const filters = transactionFiltersSchema.parse(searchParams);

  const [list, accounts, tree, quickContext] = await Promise.all([
    listTransactions(user.id, filters),
    getAccountOptions(user.id),
    getCategoryTree(user.id),
    getQuickEntryContext(user.id),
  ]);
  const categories = toCategoryOptions([...tree.expense, ...tree.income]);
  const hasFilters = Object.entries(filters).some(([key, v]) => key !== "page" && v !== undefined);

  if (accounts.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Transazioni</h1>
        <EmptyState
          illustration="wallet"
          title="Prima crea un conto"
          description="Ogni movimento appartiene a un conto: crea il tuo conto corrente, una carta o i contanti per iniziare."
          action={
            <Link href="/accounts" className={buttonVariants()}>
              Vai ai conti
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Transazioni</h1>
        <div className="flex gap-2">
          <Link href="/transactions/import" className={buttonVariants({ variant: "outline" })}>
            <Upload data-icon="inline-start" />
            Importa CSV
          </Link>
          <NewTransactionButton accounts={accounts} categories={categories} />
        </div>
      </div>

      <QuickEntry context={quickContext} accounts={accounts} categories={categories} />

      <TransactionFilters
        params={searchParams}
        filters={filters}
        accounts={accounts}
        categories={categories}
      />

      {list.total === 0 ? (
        hasFilters ? (
          <EmptyState
            illustration="search"
            title="Nessun movimento trovato"
            description="Nessun movimento corrisponde ai filtri selezionati. Prova ad allargare la ricerca."
            action={
              <Link href="/transactions" className={buttonVariants({ variant: "outline" })}>
                Reimposta filtri
              </Link>
            }
          />
        ) : (
          <EmptyState
            illustration="receipts"
            title="Nessun movimento ancora"
            description="Registra la tua prima entrata o uscita: da qui vedrai tutto lo storico, con ricerca e filtri."
            action={<NewTransactionButton accounts={accounts} categories={categories} />}
          />
        )
      ) : (
        <>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{list.total === 1 ? "1 movimento" : `${list.total} movimenti`}</span>
            <span>
              Entrate{" "}
              <span className="font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                {formatCurrency(list.income)}
              </span>
            </span>
            <span>
              Uscite{" "}
              <span className="text-foreground font-medium tabular-nums">
                {formatCurrency(list.expense)}
              </span>
            </span>
          </div>
          <TransactionList
            items={list.items.map(toTransactionDTO)}
            accounts={accounts}
            categories={categories}
          />
          <Pagination params={searchParams} page={list.page} pageCount={list.pageCount} />
        </>
      )}
    </div>
  );
}
