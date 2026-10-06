"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GainBadge } from "@/components/investments/investment-bits";
import { ValuationDialog } from "@/components/investments/valuation-dialog";
import { useCurrency, useMoney } from "@/components/currency-provider";
import { deleteValuation } from "@/app/(dashboard)/investments/actions";
import { slotColor } from "@/lib/account-types";
import { cn } from "@/lib/utils";

export type InvestmentAccountDTO = {
  id: string;
  name: string;
  currency: string;
  slot: number;
  value: number;
  invested: number;
  gain: number;
  gainPct: number | null;
  baseValue: number;
  valuedAt: string | null;
  stale: boolean;
  transactionCount: number;
  valuations: { id: string; date: string; value: number }[];
};

const day = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const formatDay = (iso: string) => day.format(new Date(`${iso}T00:00:00Z`));

/** One investment account: its value, the gain on what was put in, and the values entered. */
export function InvestmentAccountCard({ account }: { account: InvestmentAccountDTO }) {
  const money = useMoney();
  const base = useCurrency();
  const [showHistory, setShowHistory] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    const res = await deleteValuation(id).catch(() => ({ ok: false }));
    setDeleting(null);
    if (res.ok) toast.success("Valore eliminato");
    else toast.error("Non sono riuscito a eliminarlo. Riprova.");
  }

  return (
    <section
      aria-label={account.name}
      className="bg-card relative grid content-start gap-4 overflow-hidden rounded-2xl border p-5"
    >
      <span
        aria-hidden
        className="absolute inset-y-5 left-0 w-1 rounded-r-full"
        style={{ background: slotColor(account.slot) }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{account.name}</h2>
          <p className="text-muted-foreground text-xs">
            Investimenti{account.currency !== base && ` · ${account.currency}`}
          </p>
        </div>
        <Link
          href={`/transactions?accountId=${account.id}`}
          className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-0.5 text-xs"
        >
          {account.transactionCount === 1 ? "1 movimento" : `${account.transactionCount} movimenti`}
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-1">
        <p className="font-display text-3xl font-semibold tracking-tight tabular-nums">
          {money(account.value, account.currency)}
        </p>
        {account.currency !== base && (
          <p className="text-muted-foreground text-sm tabular-nums">
            ≈ {money(account.baseValue)} al cambio di oggi
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <GainBadge gain={account.gain} pct={account.gainPct} currency={account.currency} />
          <span className="text-muted-foreground">
            su {money(account.invested, account.currency)} versati
          </span>
        </p>
      </div>

      <p className={cn("text-xs", account.stale ? "text-(--warn-text)" : "text-muted-foreground")}>
        {account.valuedAt
          ? `Valore del ${formatDay(account.valuedAt)}${account.stale ? ": è ora di aggiornarlo." : "."}`
          : "Valore mai inserito: per ora conto quello che hai versato."}
      </p>

      <div className="flex flex-wrap gap-2">
        <ValuationDialog
          account={account}
          trigger={
            <Button variant={account.stale ? "default" : "outline"} size="sm">
              <RefreshCw data-icon="inline-start" />
              Aggiorna valore
            </Button>
          }
        />
        {account.valuations.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((v) => !v)}
          >
            Storico ({account.valuations.length})
            <ChevronDown
              data-icon="inline-end"
              className={cn("transition-transform", showHistory && "rotate-180")}
            />
          </Button>
        )}
      </div>

      {showHistory && (
        <ul className="-mx-1 grid max-h-64 gap-0.5 overflow-y-auto text-sm">
          {account.valuations.map((v) => (
            <li
              key={v.id}
              className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-1 py-1"
            >
              <span className="text-muted-foreground flex-1">{formatDay(v.date)}</span>
              <span className="font-medium tabular-nums">{money(v.value, account.currency)}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Elimina il valore del ${formatDay(v.date)}`}
                disabled={deleting === v.id}
                onClick={() => remove(v.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
