"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Field } from "@/components/ui";
import { RecoveryCodesView } from "@/components/action-dialog";
import type { ActionResult } from "@/lib/action";
import { confirmSetup, startSetup, type SetupStart } from "./actions";

const FAILED = { ok: false, error: "Operazione non riuscita. Riprova." };

export function SetupForm() {
  const [token, setToken] = useState("");
  const [start, setStart] = useState<SetupStart | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const typedToken = String(form.get("token") ?? "");
    const result = await startSetup({
      token: typedToken,
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      confirm: String(form.get("confirm") ?? ""),
    }).catch((): SetupStart => FAILED);
    setPending(false);
    if (!result.ok) return setError(result.error ?? "Non riuscito.");
    setToken(typedToken);
    setStart(result);
  }

  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    const result = await confirmSetup({ token, code }).catch((): ActionResult => FAILED);
    setPending(false);
    if (!result.ok || !result.codes) return setError(result.error ?? "Non riuscito.");
    setCodes(result.codes);
  }

  const alert = error && (
    <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {error}
    </p>
  );

  if (codes) {
    return saved ? (
      <div className="grid gap-4">
        <p className="text-sm text-emerald-300">
          Pannello configurato. Ora entra con email, password e codice.
        </p>
        <Link
          href="/login"
          className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-center text-sm font-medium"
        >
          Vai all&apos;accesso
        </Link>
      </div>
    ) : (
      <RecoveryCodesView codes={codes} onDone={() => setSaved(true)} />
    );
  }

  if (start) {
    return (
      <form onSubmit={onCode} className="grid gap-4">
        {alert}
        <p className="text-muted text-sm">
          Inquadra il codice QR con Google Authenticator, Microsoft Authenticator, 1Password o
          Bitwarden, poi scrivi il codice di 6 cifre.
        </p>
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(start.qr ?? "")}`}
            alt="Codice QR per l'app di autenticazione"
            width={192}
            height={192}
            className="rounded-lg bg-white p-1"
          />
        </div>
        <p className="text-muted text-xs">
          Chiave da inserire a mano:{" "}
          <code className="bg-ink rounded px-1.5 py-0.5 font-mono break-all text-slate-200">
            {start.secret}
          </code>
        </p>
        <Field
          label="Codice di 6 cifre"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          autoFocus
          required
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Verifica…" : "Attiva il pannello"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onAccount} className="grid gap-4">
      {alert}
      <Field
        label="Codice di setup"
        name="token"
        type="password"
        autoComplete="off"
        hint="Il valore di ADMIN_SETUP_TOKEN."
        required
      />
      <Field label="Nome" name="name" autoComplete="name" required />
      <Field label="Email" name="email" type="email" autoComplete="username" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Almeno 12 caratteri: questa password apre tutto."
        required
      />
      <Field
        label="Ripeti la password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Un attimo…" : "Continua"}
      </Button>
    </form>
  );
}
