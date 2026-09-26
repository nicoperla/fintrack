import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { CsvImportWizard } from "@/components/import/csv-import-wizard";
import { requireSpace } from "@/lib/auth/session";
import { getAccountOptions } from "@/lib/data/accounts";

export const metadata = { title: "Importa CSV · FinTrack" };

export default async function ImportPage() {
  const space = await requireSpace();
  const accounts = await getAccountOptions(space.id);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <Link
          href="/transactions"
          className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" />
          Transazioni
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Importa estratto conto</h1>
        <p className="text-muted-foreground text-sm">
          Carica il CSV esportato dalla tua banca: scegli le colonne, controlla i movimenti e
          importali.
        </p>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          illustration="wallet"
          title="Prima crea un conto"
          description="I movimenti importati vengono aggiunti a uno dei tuoi conti."
          action={
            <Link href="/accounts" className={buttonVariants()}>
              Vai ai conti
            </Link>
          }
        />
      ) : (
        <CsvImportWizard accounts={accounts} />
      )}
    </div>
  );
}
