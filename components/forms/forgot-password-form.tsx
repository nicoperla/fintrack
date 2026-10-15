"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { requestPasswordReset, type ResetStep } from "@/app/(auth)/actions";
import { suggestEmail } from "@/lib/auth/email-suggestion";

/**
 * "Password dimenticata?": the server checks the address first, so the answer is either "sent
 * to <email>" or why not (no account with that email, too many links, the email didn't leave).
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<ResetStep | null>(null);
  const [pending, setPending] = useState(false);

  async function send(address: string) {
    setPending(true);
    const res = await requestPasswordReset({ email: address }).catch((): ResetStep => ({
      ok: false,
      error: "Richiesta non riuscita. Riprova tra poco.",
    }));
    setResult(res);
    setPending(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(email);
  }

  if (result?.ok && result.sentTo) {
    const sentTo = result.sentTo;
    return (
      <div className="grid gap-4 text-center" role="status">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <div className="grid gap-1">
          <p className="font-medium">Ti abbiamo mandato il link</p>
          <p className="text-muted-foreground text-sm">
            L&apos;email è partita verso{" "}
            <span className="text-foreground font-medium break-all">{sentTo}</span>. Il link vale 1
            ora e funziona una volta sola.
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          Non la trovi? Guarda nello spam o tra le promozioni.
        </p>
        <div className="grid gap-2">
          <Button variant="outline" onClick={() => send(sentTo)} disabled={pending}>
            {pending ? "Invio…" : "Mandala di nuovo"}
          </Button>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Usa un&apos;altra email
          </button>
        </div>
      </div>
    );
  }

  const suggestion = result?.noAccount ? suggestEmail(email) : null;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (result && !result.ok) setResult(null);
        }}
        errors={result?.fieldErrors?.email}
      />
      {result?.noAccount && (
        <div className="grid gap-2 rounded-lg border p-3 text-sm" aria-live="polite">
          {suggestion && (
            <p>
              Forse intendevi{" "}
              <button
                type="button"
                onClick={() => {
                  setEmail(suggestion);
                  send(suggestion);
                }}
                className="text-foreground font-medium break-all underline underline-offset-4"
              >
                {suggestion}
              </button>
              ?
            </p>
          )}
          <p className="text-muted-foreground">
            Hai usato un altro indirizzo per registrarti? Prova con quello. Altrimenti{" "}
            <Link
              href={`/register?${new URLSearchParams({ email })}`}
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              crea un account con questa email
            </Link>
            .
          </p>
        </div>
      )}
      <Button type="submit" size="lg" disabled={pending || !email.trim()}>
        {pending ? "Controllo…" : "Invia il link"}
      </Button>
    </form>
  );
}
