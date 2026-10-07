"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, HandCoins } from "lucide-react";
import { AnimatedCurrency } from "@/components/dashboard/animated-currency";
import { useMoney } from "@/components/currency-provider";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { CLAIMS_DISCLAIMER, KindIcon, StatusBadge } from "@/components/claims/claim-ui";
import {
  KIND_LABELS,
  findingKey,
  formatClaimDate,
  isOpenClaim,
  type ChargeAfterCancellation,
} from "@/lib/finance/claims";
import type { ClaimsOverview, ClaimWithStep } from "@/lib/data/claims";
import { cn } from "@/lib/utils";

function Hero({ totals }: { totals: ClaimsOverview["totals"] }) {
  const money = useMoney();
  const chips = [
    totals.urgent > 0 &&
      (totals.urgent === 1 ? "1 da fare subito" : `${totals.urgent} da fare subito`),
    totals.open > 0 && (totals.open === 1 ? "1 pratica aperta" : `${totals.open} pratiche aperte`),
    totals.won > 0 && (totals.won === 1 ? "1 vinta" : `${totals.won} vinte`),
  ].filter((c): c is string => Boolean(c));

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-6 text-white sm:p-8"
      style={{ background: "linear-gradient(135deg, #047857, #0d9488 50%, #0369a1)" }}
      aria-label="Soldi recuperati"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #a7f3d0, transparent 70%)" }}
      />
      <p className="flex items-center gap-2 text-sm text-white/80">
        <HandCoins className="size-4" aria-hidden /> Recuperati con Riprenditeli
      </p>
      <AnimatedCurrency
        value={totals.recovered}
        className="mt-1 block text-5xl font-semibold tracking-tight sm:text-6xl"
      />
      <p className="mt-1 text-white/85">
        {totals.savedPerYear > 0
          ? `E ${money(totals.savedPerYear)} l'anno di abbonamenti disdetti.`
          : "Soldi tornati indietro: rimborsi, storni e addebiti annullati."}
      </p>
      {chips.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2 text-sm">
          {chips.map((c) => (
            <li key={c} className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">
              {c}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Suggestions({ items }: { items: ChargeAfterCancellation[] }) {
  const money = useMoney();
  return (
    <section
      aria-labelledby="after-title"
      className="grid gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5"
    >
      <h2 id="after-title" className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4 text-(--warn-text)" aria-hidden />
        Addebitati dopo la disdetta
      </h2>
      <ul className="divide-y text-sm">
        {items.map((s) => (
          <li key={s.transactionId} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {s.counterparty}: {money(s.amount)} il {formatClaimDate(s.date)}
              </p>
              <p className="text-muted-foreground text-xs">
                Disdetta dal {formatClaimDate(s.effectiveFrom)}. Puoi chiedere il rimborso alla
                banca fino al {formatClaimDate(s.refundBy)}.
              </p>
            </div>
            <Link
              href={`/ritrovati/pratiche/nuova?ritrovato=${encodeURIComponent(findingKey.after(s.transactionId))}`}
              className={buttonVariants({ size: "sm" })}
            >
              Chiedi il rimborso
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClaimCard({ claim }: { claim: ClaimWithStep }) {
  const money = useMoney();
  const open = isOpenClaim(claim.status);
  const amount =
    !open && claim.recoveredAmount !== null ? claim.recoveredAmount : claim.expectedAmount;
  return (
    <li>
      <Link
        href={`/ritrovati/pratiche/${claim.id}`}
        className="bg-card hover:bg-muted/40 group grid gap-2 rounded-xl border p-4 transition-colors"
      >
        <div className="flex items-start gap-3">
          <KindIcon kind={claim.kind} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{claim.counterparty}</p>
            <p className="text-muted-foreground text-xs">
              {KIND_LABELS[claim.kind]} · aperta il {formatClaimDate(claim.openedOn)}
            </p>
          </div>
          <div className="grid justify-items-end gap-1 text-right">
            <p className="font-medium tabular-nums">
              {money(amount)}
              {claim.kind === "CANCELLATION" && <span className="text-xs font-normal">/anno</span>}
            </p>
            <StatusBadge status={claim.status} />
          </div>
          <ChevronRight
            className="text-muted-foreground mt-2 size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
        {open && (
          <p
            className={cn(
              "text-sm",
              claim.step.tone === "urgent"
                ? "font-medium text-(--warn-text)"
                : "text-muted-foreground",
            )}
          >
            {claim.step.text}
          </p>
        )}
      </Link>
    </li>
  );
}

function ClaimList({ title, claims }: { title: string; claims: ClaimWithStep[] }) {
  if (claims.length === 0) return null;
  return (
    <section className="grid gap-3" aria-label={title}>
      <h2 className="font-medium">
        {title} <span className="text-muted-foreground text-sm font-normal">({claims.length})</span>
      </h2>
      <ul className="grid gap-3">
        {claims.map((c) => (
          <ClaimCard key={c.id} claim={c} />
        ))}
      </ul>
    </section>
  );
}

// What can't wait comes first; otherwise the newest first, as they arrive.
const urgentFirst = (list: ClaimWithStep[]) =>
  [...list].sort((a, b) => Number(b.step.tone === "urgent") - Number(a.step.tone === "urgent"));

export function ClaimsBoard({ overview }: { overview: ClaimsOverview }) {
  const { claims, suggestions, totals } = overview;
  const nothingYet = claims.length === 0 && suggestions.length === 0;
  return (
    <div className="grid gap-6">
      <Hero totals={totals} />
      {suggestions.length > 0 && <Suggestions items={suggestions} />}
      {nothingYet ? (
        <EmptyState
          illustration="receipts"
          title="Nessuna pratica, per ora"
          description="Apri una pratica da Soldi ritrovati, oppure da un addebito che vuoi contestare nei movimenti: la lettera la scrivo io, le scadenze le conto io."
          action={
            <Link href="/ritrovati" className={buttonVariants()}>
              Vai a Soldi ritrovati
            </Link>
          }
        />
      ) : (
        <>
          <ClaimList
            title="Da inviare"
            claims={urgentFirst(claims.filter((c) => c.status === "DRAFT"))}
          />
          <ClaimList
            title="In attesa di risposta"
            claims={urgentFirst(claims.filter((c) => c.status === "SENT"))}
          />
          <ClaimList title="Chiuse" claims={claims.filter((c) => !isOpenClaim(c.status))} />
        </>
      )}
      <p className="text-muted-foreground text-xs">{CLAIMS_DISCLAIMER}</p>
    </div>
  );
}
