"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { registerUser, type ActionResult } from "@/app/(auth)/actions";

export function RegisterForm() {
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
    router.replace("/dashboard");
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
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creazione account…" : "Crea account"}
      </Button>
    </form>
  );
}
