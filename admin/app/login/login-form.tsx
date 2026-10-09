"use client";

import { useState, type FormEvent } from "react";
import { Button, Field } from "@/components/ui";
import type { ActionResult } from "@/lib/action";
import { login } from "./actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    // On success the action redirects and this never returns.
    const result = await login({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      code: String(form.get("code") ?? ""),
    }).catch((): ActionResult => ({ ok: false, error: "Accesso non riuscito. Riprova." }));
    if (result && !result.ok) {
      setError(result.error ?? "Accesso non riuscito.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <Field label="Email" name="email" type="email" autoComplete="username" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Field
        label="Codice di verifica"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        hint="Dall'app di autenticazione, oppure un codice di recupero."
        required
      />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Verifica…" : "Entra"}
      </Button>
    </form>
  );
}
