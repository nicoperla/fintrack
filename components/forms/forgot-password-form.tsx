"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { requestPasswordReset } from "@/app/(auth)/actions";
import type { ActionResult } from "@/lib/action-result";

export function ForgotPasswordForm() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await requestPasswordReset({ email: form.get("email") }).catch(() => ({
      ok: false,
      error: "Richiesta non riuscita. Riprova tra poco.",
    }));
    setResult(res);
    setPending(false);
  }

  if (result?.ok) {
    return (
      <FormMessage tone="success">
        Se esiste un account con questa email, riceverai a breve un link per reimpostare la
        password. Il link è valido per 1 ora.
      </FormMessage>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={result?.fieldErrors?.email}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Invio…" : "Invia link di reset"}
      </Button>
    </form>
  );
}
