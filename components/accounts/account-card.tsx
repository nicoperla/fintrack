"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { deleteAccount } from "@/app/(dashboard)/accounts/actions";
import { ACCOUNT_TYPES } from "@/lib/account-types";
import { useCurrency, useMoney } from "@/components/currency-provider";
import { GainBadge } from "@/components/investments/investment-bits";
import { cn } from "@/lib/utils";
import type { AccountDTO } from "@/lib/dto";

/** An investment account shows what it's worth (the value entered by hand), not its book balance. */
type InvestmentFigures = { value: number; gain: number; gainPct: number | null };

export function AccountCard({
  account,
  investment,
}: {
  account: AccountDTO;
  investment?: InvestmentFigures;
}) {
  const money = useMoney();
  const baseCurrency = useCurrency();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const meta = ACCOUNT_TYPES[account.type];
  const Icon = meta.icon;
  const negative = Number(account.balance) < 0;

  return (
    <div className="bg-card flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Icon className="text-muted-foreground size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{account.name}</p>
          <p className="text-muted-foreground text-xs">
            {meta.label}
            {account.currency !== baseCurrency && ` · ${account.currency}`}
          </p>
        </div>
        <div className="-mt-1 -mr-1 flex">
          <AccountFormDialog
            account={account}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Modifica ${account.name}`}>
                <Pencil />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Elimina ${account.name}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {investment ? (
        <div className="grid gap-0.5">
          <p className="text-2xl font-semibold tabular-nums">
            {money(investment.value, account.currency)}
          </p>
          <p className="text-sm">
            <GainBadge
              gain={investment.gain}
              pct={investment.gainPct}
              currency={account.currency}
            />
          </p>
        </div>
      ) : (
        <div>
          <p className={cn("text-2xl font-semibold tabular-nums", negative && "text-destructive")}>
            {money(account.balance, account.currency)}
          </p>
          {account.currency !== baseCurrency && (
            <p className="text-muted-foreground text-sm tabular-nums">
              ≈ {money(account.baseBalance)} al cambio di oggi
            </p>
          )}
        </div>
      )}

      <Link
        href={investment ? "/investments" : `/transactions?accountId=${account.id}`}
        className="text-muted-foreground hover:text-foreground -mb-1 flex items-center justify-between text-sm"
      >
        {investment
          ? "Valore e rendimento"
          : account.transactionCount === 1
            ? "1 movimento"
            : `${account.transactionCount} movimenti`}
        <ChevronRight className="size-4" />
      </Link>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Eliminare "${account.name}"?`}
        description={
          account.transactionCount > 0
            ? `${
                account.transactionCount === 1
                  ? "Verrà eliminato anche il movimento collegato a questo conto."
                  : `Verranno eliminati anche i ${account.transactionCount} movimenti collegati, compresi i trasferimenti da e verso questo conto.`
              } L'operazione non è reversibile.`
            : "L'operazione non è reversibile."
        }
        successMessage="Conto eliminato"
        onConfirm={() => deleteAccount(account.id)}
      />
    </div>
  );
}
