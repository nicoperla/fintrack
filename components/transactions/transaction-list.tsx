"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { deleteTransaction } from "@/app/(dashboard)/transactions/actions";
import { CategoryIcon } from "@/lib/category-style";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AccountOption, CategoryOption, TransactionDTO } from "@/lib/dto";
import { cn } from "@/lib/utils";

function groupByDate(items: TransactionDTO[]) {
  const groups: { date: string; items: TransactionDTO[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last?.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}

function AmountText({ tx }: { tx: TransactionDTO }) {
  const value = formatCurrency(tx.amount);
  if (tx.type === "INCOME") {
    return <span className="text-emerald-600 dark:text-emerald-400">+{value}</span>;
  }
  if (tx.type === "EXPENSE") return <span>−{value}</span>;
  return <span className="text-muted-foreground">{value}</span>;
}

function TransactionRow({ tx, onSelect }: { tx: TransactionDTO; onSelect: () => void }) {
  const subtitle =
    tx.type === "TRANSFER"
      ? `${tx.account.name} → ${tx.transferAccount?.name ?? "?"}`
      : [
          tx.category
            ? tx.category.parentName
              ? `${tx.category.parentName} › ${tx.category.name}`
              : tx.category.name
            : "Senza categoria",
          tx.account.name,
        ].join(" · ");

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="hover:bg-muted/60 focus-visible:bg-muted/60 flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left outline-none"
      >
        {tx.type === "TRANSFER" ? (
          <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
            <ArrowLeftRight className="text-muted-foreground size-4" />
          </span>
        ) : (
          <CategoryIcon name={tx.category?.icon} color={tx.category?.color} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{tx.description}</span>
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            <span className="truncate">{subtitle}</span>
            {tx.tags.map((tag) => (
              <span key={tag} className="bg-muted shrink-0 rounded px-1.5 py-px text-[10px]">
                #{tag}
              </span>
            ))}
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium tabular-nums">
          <AmountText tx={tx} />
        </span>
      </button>
    </li>
  );
}

export function TransactionList({
  items,
  accounts,
  categories,
}: {
  items: TransactionDTO[];
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [editing, setEditing] = useState<TransactionDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<TransactionDTO | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        {groupByDate(items).map((group) => (
          <section key={group.date}>
            <h3 className="text-muted-foreground mb-1 px-2 text-xs font-medium tracking-wide uppercase">
              {formatDate(new Date(`${group.date}T00:00:00.000Z`))}
            </h3>
            <ul className={cn("bg-card rounded-xl border p-1")}>
              {group.items.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  onSelect={() => {
                    setEditing(tx);
                    setFormOpen(true);
                  }}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editing}
        accounts={accounts}
        categories={categories}
        onDelete={(tx) => {
          setFormOpen(false);
          setDeleting(tx);
        }}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Eliminare questo movimento?"
        description={
          deleting
            ? `"${deleting.description}" di ${formatCurrency(deleting.amount)} verrà eliminato. L'operazione non è reversibile.`
            : ""
        }
        successMessage="Movimento eliminato"
        onConfirm={() =>
          deleting ? deleteTransaction(deleting.id) : Promise.resolve({ ok: true })
        }
      />
    </>
  );
}
