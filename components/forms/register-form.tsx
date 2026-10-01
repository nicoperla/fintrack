"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { registerUser } from "@/app/(auth)/actions";
import type { ActionResult } from "@/lib/action-result";

export function RegisterForm({
  callbackUrl = "/dashboard",
  email,
}: {
  callbackUrl?: string;
  /** Prefilled from an invitation. */
  email?: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const values = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      acceptTerms: form.get("acceptTerms") === "on",
    };

    const res = await registerUser(values).catch(() => ({
      ok: false,
      error: "Registrazione non riuscita. Riprova tra poco.",
    }));
    if (!res.ok) {
      setResult(res);
      setPending(false);
      return;
    }

    const login = await signIn("credentials", { ...values, redirect: false });
    if (!login?.ok) {
      router.replace("/login");
      return;
    }
    router.replace(callbackUrl);
    router.refresh();
  }

  const errors = result?.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
      <FormField
        label="Nome"
        name="name"
        autoComplete="given-name"
        required
        errors={errors?.name}
      />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={email}
        required
        errors={errors?.email}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="Almeno 8 caratteri"
        required
        errors={errors?.password}
      />
      <div className="grid gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            className="accent-primary mt-0.5 size-4 shrink-0"
            aria-invalid={errors?.acceptTerms ? true : undefined}
            aria-describedby={errors?.acceptTerms ? "acceptTerms-error" : undefined}
          />
          <span className="text-muted-foreground">
            Ho almeno 18 anni e accetto i{" "}
            <Link
              href="/terms"
              target="_blank"
              className="text-foreground underline underline-offset-4"
            >
              termini di servizio
            </Link>{" "}
            e l&apos;
            <Link
              href="/privacy"
              target="_blank"
              className="text-foreground underline underline-offset-4"
            >
              informativa sulla privacy
            </Link>
            .
          </span>
        </label>
        {errors?.acceptTerms && (
          <p id="acceptTerms-error" className="text-destructive text-sm">
            {errors.acceptTerms[0]}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creazione account…" : "Crea account"}
      </Button>
    </form>
  );
}
