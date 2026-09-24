"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { resetPassword, type ActionResult } from "@/app/(auth)/actions";

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
      <FormField
        label="Nuova password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="Almeno 8 caratteri"
        required
        errors={errors?.password}
      />
      <FormField
        label="Conferma password"
        name="confirmPassword"
        type="password"
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
