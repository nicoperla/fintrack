"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/forms/form-field";
import { PasswordField } from "@/components/forms/password-field";
import { resetPassword } from "@/app/(auth)/actions";
import type { ActionResult } from "@/lib/action-result";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await resetPassword({
      token,
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    }).catch(() => ({ ok: false, error: "Reset non riuscito. Riprova tra poco." }));
    if (res.ok) {
      router.replace("/login?reset=1");
      return;
    }
    setResult(res);
    setPending(false);
  }

  const errors = result?.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
      <PasswordField
        label="Nuova password"
        name="password"
        autoComplete="new-password"
        placeholder="Almeno 10 caratteri"
        hint="Dopo il cambio chiudiamo le sessioni aperte su tutti i dispositivi."
        required
        errors={errors?.password}
      />
      <PasswordField
        label="Conferma password"
        name="confirmPassword"
        autoComplete="new-password"
        required
        errors={errors?.confirmPassword}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Salvataggio…" : "Imposta nuova password"}
      </Button>
    </form>
  );
}
