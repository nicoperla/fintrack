"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { PasswordField } from "@/components/forms/password-field";
import { startLogin, type LoginStep } from "@/app/(auth)/actions";

const CODE_ERRORS: Record<string, string> = {
  BAD_CODE:
    "Codice non valido. Usa quello di FinTrack nell'app e controlla che l'ora del telefono sia giusta.",
  RATE_LIMITED: "Troppi codici sbagliati. Aspetta un quarto d'ora e riprova.",
};

/** Trades the ticket from the password step for a session; the error code when it fails. */
async function finishSignIn(ticket: string, code?: string) {
  // Only send "code" when there is one: signIn would turn undefined into the text "undefined".
  const res = await signIn("credentials", {
    ticket,
    ...(code ? { code } : {}),
    redirect: false,
  });
  return res?.ok ? null : (res?.error ?? "ERROR");
}

export function LoginForm({ callbackUrl, notice }: { callbackUrl: string; notice?: string }) {
  const router = useRouter();
  const [result, setResult] = useState<LoginStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Set once the password was right and the account wants the 2FA code. */
  const [ticket, setTicket] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);
  /** Kept so going back to the password step doesn't make the user type it again. */
  const [email, setEmail] = useState("");

  function enter() {
    router.replace(callbackUrl);
    router.refresh();
  }

  function backToPassword(message: string | null) {
    setTicket(null);
    setRecovery(false);
    setError(message);
    setPending(false);
  }

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    setEmail(String(form.get("email") ?? ""));
    const res = await startLogin({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    }).catch((): LoginStep => ({ ok: false, error: "Accesso non riuscito. Riprova tra poco." }));
    setResult(res);
    if (!res.ok || !res.ticket) {
      setPending(false);
      return;
    }
    if (res.needsCode) {
      setTicket(res.ticket);
      setPending(false);
      return;
    }
    const failed = await finishSignIn(res.ticket);
    if (failed) return backToPassword("Accesso non riuscito. Riprova.");
    enter();
  }

  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket) return;
    setError(null);
    setPending(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    if (!code) {
      setError(recovery ? "Inserisci un codice di recupero." : "Inserisci il codice di 6 cifre.");
      setPending(false);
      return;
    }
    const failed = await finishSignIn(ticket, code);
    if (!failed) return enter();
    if (failed in CODE_ERRORS) {
      setError(CODE_ERRORS[failed]);
      setPending(false);
      return;
    }
    // Expired, used up by too many wrong codes, or opened in another browser.
    backToPassword("L'accesso è scaduto: inserisci di nuovo email e password.");
  }

  if (ticket) {
    return (
      <form onSubmit={onCode} className="grid gap-4" noValidate>
        <div className="flex gap-3 rounded-lg border p-3 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden />
          <p className="text-muted-foreground">
            {recovery
              ? "Inserisci uno dei codici di recupero che hai salvato quando hai attivato la verifica in due passaggi. Ogni codice vale una volta sola."
              : "Apri l'app di autenticazione sul telefono e inserisci il codice di 6 cifre di FinTrack."}
          </p>
        </div>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {recovery ? (
          <FormField
            key="recovery"
            label="Codice di recupero"
            name="code"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="xxxxx-xxxxx"
            autoFocus
            required
          />
        ) : (
          <FormField
            key="totp"
            label="Codice di verifica"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            placeholder="123456"
            className="text-center font-mono text-lg tracking-[0.3em]"
            autoFocus
            required
          />
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Verifica in corso…" : "Verifica e accedi"}
        </Button>
        <div className="text-muted-foreground flex flex-col items-center gap-1 text-sm">
          <button
            type="button"
            className="hover:text-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setRecovery((r) => !r);
              setError(null);
            }}
          >
            {recovery ? "Usa il codice dell'app" : "Non hai il telefono? Usa un codice di recupero"}
          </button>
          <button
            type="button"
            className="hover:text-foreground underline-offset-4 hover:underline"
            onClick={() => backToPassword(null)}
          >
            Torna indietro
          </button>
        </div>
      </form>
    );
  }

  const errors = result?.fieldErrors;
  const message = error ?? result?.error;
  return (
    <form onSubmit={onPassword} className="grid gap-4" noValidate>
      {notice && !message && <FormMessage tone="success">{notice}</FormMessage>}
      {message && <FormMessage tone="error">{message}</FormMessage>}
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        defaultValue={email}
        required
        errors={errors?.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        errors={errors?.password}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Accesso in corso…" : "Accedi"}
      </Button>
    </form>
  );
}
