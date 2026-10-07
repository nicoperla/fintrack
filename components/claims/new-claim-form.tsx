"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import type { ClaimKind } from "@prisma/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { KIND_ICONS } from "@/components/claims/claim-ui";
import { useMoney } from "@/components/currency-provider";
import { openClaim } from "@/app/(dashboard)/ritrovati/pratiche/actions";
import { CLAIM_KINDS, KIND_LABELS, formatClaimDate } from "@/lib/finance/claims";
import type { ClaimPrefill } from "@/lib/data/claims";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const KIND_HINTS: Record<ClaimKind, string> = {
  CANCELLATION:
    "Smetti di pagare un abbonamento o un servizio. Dopo l'invio controllo io che non ti addebitino più niente.",
  DIRECT_DEBIT_REFUND:
    "Un addebito diretto SEPA (RID) degli ultimi due mesi: entro 8 settimane la banca te lo restituisce senza chiederti perché.",
  BANK_COMPLAINT:
    "Commissioni che non ti tornano o un addebito che non hai autorizzato. Se la banca non risponde, c'è l'Arbitro Bancario Finanziario.",
  DUPLICATE_CHARGE:
    "Un negozio ti ha addebitato due volte o più del dovuto: gli chiedi di restituirti la differenza.",
};

const COUNTERPARTY_LABELS: Record<ClaimKind, { label: string; hint: string }> = {
  CANCELLATION: {
    label: "Servizio da disdire",
    hint: "Come compare nella lettera: «Disdetta abbonamento …».",
  },
  DIRECT_DEBIT_REFUND: {
    label: "Chi ha fatto l'addebito",
    hint: "L'azienda che ha incassato. La richiesta va alla tua banca.",
  },
  BANK_COMPLAINT: {
    label: "Banca o beneficiario dell'addebito",
    hint: "Per le commissioni, il nome della tua banca o del conto.",
  },
  DUPLICATE_CHARGE: { label: "Negozio", hint: "La richiesta va prima al negozio." },
};

const toInput = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));

export function NewClaimForm({
  prefill,
  canOpen,
  openClaimId,
}: {
  prefill: ClaimPrefill;
  canOpen: boolean;
  /** On the free plan, the claim already in progress. */
  openClaimId: string | null;
}) {
  const router = useRouter();
  const money = useMoney();
  const [kind, setKind] = useState<ClaimKind>(prefill.kind);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const tx = prefill.transaction;

  if (!canOpen) {
    return (
      <div className="bg-card grid gap-3 rounded-2xl border border-dashed p-5 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Lock className="size-4" aria-hidden /> Con il piano gratuito segui una pratica alla volta
        </p>
        <p className="text-muted-foreground">
          Chiudi quella in corso (anche segnandola come lasciata perdere) oppure passa a Pro per
          aprirne quante vuoi.
        </p>
        <div className="flex flex-wrap gap-2">
          {openClaimId && (
            <Link
              href={`/ritrovati/pratiche/${openClaimId}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Vai alla pratica aperta
            </Link>
          )}
          <Link href="/settings#abbonamento" className={buttonVariants()}>
            Scopri Pro
          </Link>
        </div>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    setPending(true);
    const res = await openClaim({
      kind,
      counterparty: text("counterparty"),
      amount: text("amount"),
      chargeDate: tx ? "" : text("chargeDate"),
      effectiveFrom:
        kind === "CANCELLATION" ? text("effectiveFrom") : (prefill.effectiveFrom ?? ""),
      // One claim per finding, whatever the user decides to ask for.
      findingKey: prefill.findingKey ?? "",
      transactionId: tx?.id ?? "",
    }).catch((): ActionResult & { id?: string } => ({
      ok: false,
      error: "Non sono riuscito ad aprire la pratica. Riprova.",
    }));
    if (res.ok && res.id) {
      toast.success("Pratica aperta: la lettera è pronta");
      router.push(`/ritrovati/pratiche/${res.id}`);
      return;
    }
    setPending(false);
    setResult(res);
  }

  const errors = result?.fieldErrors;
  const who = COUNTERPARTY_LABELS[kind];

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Cosa vuoi ottenere</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CLAIM_KINDS.map((k) => {
            const Icon = KIND_ICONS[k];
            return (
              <label
                key={k}
                className={cn(
                  "has-focus-visible:ring-ring/50 flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-3",
                  kind === k ? "border-emerald-500/60 bg-emerald-500/5" : "hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="sr-only"
                />
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    kind === k ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">{KIND_LABELS[k]}</span>
                  <span className="text-muted-foreground text-xs">{KIND_HINTS[k]}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors?.kind && <p className="text-destructive text-sm">{errors.kind[0]}</p>}
      </fieldset>

      {tx && (
        <div className="bg-muted/40 rounded-xl border p-3 text-sm">
          <p className="text-muted-foreground text-xs">Movimento contestato</p>
          <p className="font-medium">{tx.description}</p>
          <p className="text-muted-foreground text-xs">
            {formatClaimDate(tx.date)} · {tx.account} · {money(tx.amount)}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={who.label}
          name="counterparty"
          defaultValue={prefill.counterparty}
          maxLength={80}
          hint={who.hint}
          errors={errors?.counterparty}
        />
        <FormField
          label={kind === "CANCELLATION" ? "Quanto costa in un anno (€)" : "Importo (€)"}
          name="amount"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={toInput(prefill.amount)}
          errors={errors?.amount}
        />
        {!tx && kind !== "CANCELLATION" && (
          <FormField
            label="Data dell'addebito"
            name="chargeDate"
            type="date"
            defaultValue={prefill.chargeDate ?? ""}
            hint={
              kind === "DIRECT_DEBIT_REFUND"
                ? "Le 8 settimane per il rimborso partono da qui."
                : undefined
            }
            errors={errors?.chargeDate}
          />
        )}
        {kind === "CANCELLATION" && (
          <FormField
            label="Da quando non vuoi più pagare (facoltativo)"
            name="effectiveFrom"
            type="date"
            defaultValue={prefill.effectiveFrom ?? ""}
            hint="Vuota, la lettera dice «dalla prima scadenza utile»."
            errors={errors?.effectiveFrom}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Preparo la lettera…" : "Apri la pratica e scrivi la lettera"}
        </Button>
        <p className="text-muted-foreground text-xs">
          Potrai rileggere e modificare la lettera prima di inviarla.
        </p>
      </div>
    </form>
  );
}
