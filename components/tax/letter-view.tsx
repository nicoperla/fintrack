"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Camera,
  FileText,
  ListChecks,
  Loader2,
  MailOpen,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProLock, TaxSection, TONE_BOX, TONE_TEXT } from "@/components/tax/ui";
import { setAiConsent } from "@/app/(dashboard)/coach/actions";
import { longDay } from "@/lib/tax/calendar";
import { LETTER_MAX_BYTES, type LetterExplanation } from "@/lib/tax/letter";
import { cn } from "@/lib/utils";

type Status = "off" | "pro" | "verify" | "consent" | "ready";

const URGENCY = {
  alta: { label: "Urgente", tone: "bad" as const },
  media: { label: "Da fare", tone: "warn" as const },
  bassa: { label: "Informativa", tone: "info" as const },
};

export function LetterView({ status, provider }: { status: Status; provider: string | null }) {
  const money = useMoney();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<Status>(status);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LetterExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function consent() {
    const res = await setAiConsent(true).catch(() => ({ ok: false }));
    if (res.ok) setState("ready");
    else toast.error("Non riuscito. Riprova.");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > LETTER_MAX_BYTES) {
      setError("Il file è troppo grande: al massimo 5 MB.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/730/lettera", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.explanation) {
        if (json?.code === "consent") setState("consent");
        setError(json?.error ?? "Non riesco a leggerla adesso. Riprova.");
      } else {
        setResult(json.explanation as LetterExplanation);
      }
    } catch {
      setError("Connessione assente: riprova quando sei online.");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <TaxSection
        id="lettera"
        icon={MailOpen}
        title="La lettera"
        subtitle="Agenzia delle Entrate, INPS, Comune, una multa, la riscossione: fotografala e te la spiego in parole semplici."
      >
        {state === "off" && (
          <p className="text-muted-foreground text-sm">
            La lettura delle lettere non è attiva su questo server.
          </p>
        )}
        {state === "pro" && (
          <ProLock what="fotografi una lettera e te la spiego, con la scadenza e cosa fare" />
        )}
        {state === "verify" && (
          <p className="text-sm">
            Conferma la tua email per usarla: trovi il link nella posta che ti abbiamo mandato.
          </p>
        )}
        {state === "consent" && (
          <div className="grid gap-3 rounded-xl border p-4 text-sm">
            <p>
              Per leggerla, la foto viene inviata a {provider ?? "un fornitore di AI"}: la usa solo
              per rispondere e Orbitly non la conserva. Le lettere possono contenere dati personali
              e di salute, quindi serve il tuo consenso (lo stesso del coach AI, puoi toglierlo
              dalle impostazioni).
            </p>
            <Button className="justify-self-start" onClick={() => void consent()}>
              Accetto, attiva la lettura
            </Button>
          </div>
        )}
        {state === "ready" && (
          <div className="grid gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              id="letter-file"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => fileRef.current?.click()} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Camera />}
                {loading
                  ? "Leggo la lettera…"
                  : result
                    ? "Leggi un'altra lettera"
                    : "Fotografa o carica la lettera"}
              </Button>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <ShieldCheck className="size-3.5" aria-hidden /> La foto non viene salvata.
              </p>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
        )}
      </TaxSection>

      {result && !result.readable && (
        <p className={cn("rounded-xl border p-4 text-sm", TONE_BOX.warn)}>
          Non riesco a leggere bene questa lettera. Prova con una foto più vicina, dritta e con più
          luce, o con il PDF se ce l&apos;hai.
        </p>
      )}

      {result && result.readable && (
        <TaxSection
          id="spiegazione"
          icon={FileText}
          title={result.kind ?? "La spiegazione"}
          subtitle={result.sender ?? undefined}
          aside={
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                TONE_BOX[URGENCY[result.urgency].tone],
                TONE_TEXT[URGENCY[result.urgency].tone],
              )}
            >
              {URGENCY[result.urgency].label}
            </span>
          }
        >
          {result.summary && <p className="text-sm leading-relaxed">{result.summary}</p>}
          {(result.amount !== null || result.deadline || result.deadlineText) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {result.amount !== null && (
                <div className="rounded-xl border p-3 text-sm">
                  <p className="text-muted-foreground text-xs">Importo</p>
                  <p className="text-xl font-semibold tabular-nums">{money(result.amount)}</p>
                </div>
              )}
              {(result.deadline || result.deadlineText) && (
                <div className="rounded-xl border p-3 text-sm">
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <CalendarClock className="size-3.5" aria-hidden /> Scadenza
                  </p>
                  <p className="font-medium">
                    {result.deadline
                      ? `${longDay(result.deadline)} ${result.deadline.slice(0, 4)}`
                      : result.deadlineText}
                  </p>
                  {result.deadline && result.deadlineText && (
                    <p className="text-muted-foreground text-xs">{result.deadlineText}</p>
                  )}
                </div>
              )}
            </div>
          )}
          {result.steps.length > 0 && (
            <div className="grid gap-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <ListChecks className="size-4" aria-hidden /> Cosa fare
              </p>
              <ol className="grid gap-1 text-sm">
                {result.steps.map((step, i) => (
                  <li key={step} className="flex gap-2">
                    <span className="text-muted-foreground tabular-nums">{i + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {result.documents.length > 0 && (
            <div className="grid gap-1">
              <p className="text-sm font-medium">Da preparare</p>
              <ul className="text-muted-foreground grid gap-0.5 text-sm">
                {result.documents.map((d) => (
                  <li key={d}>· {d}</li>
                ))}
              </ul>
            </div>
          )}
          {result.caution && (
            <p className={cn("flex gap-2 rounded-xl border p-3 text-sm", TONE_BOX.warn)}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              {result.caution}
            </p>
          )}
          <p className="text-muted-foreground flex items-start gap-2 text-xs">
            <Bot className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Spiegazione generata dall&apos;intelligenza artificiale: può sbagliare, controlla sempre
            la lettera originale. Non è consulenza legale o fiscale: per i casi complicati rivolgiti
            a un CAF, a un patronato o a un professionista.
          </p>
          <Link
            href="/730"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "justify-self-start")}
          >
            Torna al mio 730
          </Link>
        </TaxSection>
      )}
    </div>
  );
}
