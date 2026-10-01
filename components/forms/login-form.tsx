"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/components/forms/form-field";

export function LoginForm({ callbackUrl, notice }: { callbackUrl: string; notice?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    if (!res?.ok) {
      setError(
        res?.error === "RATE_LIMITED"
          ? "Troppi tentativi di accesso. Aspetta qualche minuto e riprova."
          : "Email o password non corretti.",
      );
      setPending(false);
      return;
    }
    router.replace(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {notice && <FormMessage tone="success">{notice}</FormMessage>}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <FormField label="Email" name="email" type="email" autoComplete="email" required />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Accesso in corso…" : "Accedi"}
      </Button>
    </form>
  );
}
