"use client";

import { useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";
import { CreditCard, Download, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, FormMessage } from "@/components/forms/form-field";
import type { ActionResult } from "@/lib/action-result";
import { setAiConsent } from "@/app/(dashboard)/coach/actions";
import { deleteAccount } from "./account-actions";
import { openBillingPortal, startCheckout } from "./billing-actions";

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export type BillingInfo = {
  enabled: boolean;
  plan: "FREE" | "PRO";
  status: string | null;
  renewsAt: string | null;
  cancelsAtEnd: boolean;
  /** "4,99 € al mese", or null when the price can't be read. */
  priceLabel: string | null;
  features: string[];
  dailyQuestions: number;
};

export function BillingSection({ billing }: { billing: BillingInfo }) {
  const [pending, setPending] = useState(false);

  async function go(action: () => Promise<ActionResult>) {
    setPending(true);
    // On success the action redirects to Stripe and this never returns.
    const res = await action().catch((): ActionResult => ({ ok: false }));
    setPending(false);
    if (res && !res.ok) toast.error(res.error ?? "Non riesco ad aprire la pagina di pagamento.");
  }

  const pro = billing.plan === "PRO";
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4" aria-hidden /> Piano {pro ? "Pro" : "Gratuito"}
          </p>
          <p className="text-muted-foreground text-sm">
            {pro
              ? billing.renewsAt
                ? billing.cancelsAtEnd
                  ? `Disdetto: Pro resta attivo fino al ${dateFormat.format(new Date(billing.renewsAt))}.`
                  : `Si rinnova il ${dateFormat.format(new Date(billing.renewsAt))}.`
                : "Abbonamento attivo."
              : "Tutta l'app è gratis. Pro aggiunge il coach AI."}
            {billing.status === "past_due" &&
              " L'ultimo pagamento non è andato a buon fine: aggiorna la carta per non perdere Pro."}
          </p>
        </div>
        {billing.priceLabel && !pro && (
          <span className="bg-muted rounded-full px-3 py-1 text-sm font-medium">
            {billing.priceLabel}
          </span>
        )}
      </div>

      {!pro && (
        <ul className="text-muted-foreground grid gap-1 text-sm">
          {billing.features.map((f) => (
            <li key={f} className="flex gap-2">
              <span aria-hidden>✓</span>
              {f}
            </li>
          ))}
        </ul>
      )}

      {billing.enabled ? (
        <Button
          className="justify-self-start"
          variant={pro ? "outline" : "default"}
          disabled={pending}
          onClick={() => go(pro ? openBillingPortal : startCheckout)}
        >
          <CreditCard />
          {pending ? "Apertura…" : pro ? "Gestisci abbonamento" : "Passa a Pro"}
        </Button>
      ) : (
        <p className="text-muted-foreground text-sm">
          I pagamenti non sono ancora attivi: per ora il coach AI è disponibile per tutti, fino a{" "}
          {billing.dailyQuestions} domande al giorno.
        </p>
      )}
    </div>
  );
}

export function PrivacySection({
  aiConsent,
  aiProvider,
}: {
  aiConsent: boolean;
  /** Who receives the data when the AI coach is on; null when no AI is configured. */
  aiProvider: string | null;
}) {
  const [consent, setConsent] = useState(aiConsent);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function toggleConsent() {
    const next = !consent;
    setConsent(next);
    const res = await setAiConsent(next).catch(() => null);
    if (res?.ok)
      toast.success(next ? "Coach AI attivato" : "Consenso revocato: il coach AI è spento");
    else {
      setConsent(!next);
      toast.error("Non sono riuscito a salvare. Riprova.");
    }
  }

  return (
    <div className="grid gap-5">
      {aiProvider && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="ai-consent-label" className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4" aria-hidden /> Coach AI
            </p>
            <p className="text-muted-foreground text-sm">
              {consent
                ? `Attivo: le tue domande e un riepilogo dei dati vanno a ${aiProvider}.`
                : "Spento: nessun dato viene inviato a fornitori di AI."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={consent}
            aria-labelledby="ai-consent-label"
            onClick={toggleConsent}
            className={
              "focus-visible:ring-ring/50 relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-3 " +
              (consent ? "bg-primary" : "bg-input")
            }
          >
            <span
              className={
                "bg-background size-5 rounded-full shadow-sm transition-transform " +
                (consent ? "translate-x-5.5" : "translate-x-0.5")
              }
            />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">I tuoi dati</p>
          <p className="text-muted-foreground text-sm">
            Un file con profilo, conti, movimenti, budget, obiettivi e debiti di tutti i tuoi spazi.
          </p>
        </div>
        <a href="/api/account/export" download className={buttonVariants({ variant: "outline" })}>
          <Download />
          Scarica i tuoi dati
        </a>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Elimina account</p>
          <p className="text-muted-foreground text-sm">
            Cancella per sempre l&apos;account e i tuoi spazi personali.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 />
          Elimina account
        </Button>
      </div>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const res = await deleteAccount({
      password: String(form.get("password") ?? ""),
      confirm: String(form.get("confirm") ?? ""),
    }).catch((): ActionResult => ({ ok: false, error: "Eliminazione non riuscita. Riprova." }));
    if (!res.ok) {
      setPending(false);
      setResult(res);
      return;
    }
    // The cached pages hold this account's finances.
    navigator.serviceWorker?.controller?.postMessage("clear-pages");
    await signOut({ callbackUrl: "/?account=eliminato" });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminare l&apos;account?</DialogTitle>
          <DialogDescription>
            Cancelliamo subito il tuo profilo, i tuoi spazi personali con conti, movimenti, budget,
            obiettivi e debiti, ed eventuali abbonamenti. Non si può annullare: se vuoi una copia,
            scarica prima i tuoi dati.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
          <p className="text-muted-foreground text-sm">
            Negli spazi condivisi con altre persone i dati restano a loro; se ne sei il
            proprietario, lo spazio passa a chi ne fa parte da più tempo.
          </p>
          <FormField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            errors={result?.fieldErrors?.password}
          />
          <FormField
            label="Scrivi ELIMINA per confermare"
            name="confirm"
            autoComplete="off"
            errors={result?.fieldErrors?.confirm}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Eliminazione…" : "Elimina per sempre"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
