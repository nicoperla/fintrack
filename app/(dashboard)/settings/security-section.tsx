"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Copy,
  Download,
  KeyRound,
  LaptopMinimal,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { PasswordField } from "@/components/forms/password-field";
import {
  changePassword,
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateRecoveryCodes,
  signOutOtherDevices,
  startTwoFactorSetup,
  type SecurityResult,
  type TwoFactorSetup,
} from "./security-actions";

export type SecurityInfo = {
  email: string;
  /** ISO date 2FA was turned on; null: off. */
  twoFactorSince: string | null;
  recoveryLeft: number;
  devices: { label: string; place: string | null; lastLoginAt: string; current: boolean }[];
};

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const FAILED: SecurityResult = { ok: false, error: "Operazione non riuscita. Riprova tra poco." };

/** The actions that end the other sessions return a ticket: this browser gets a new session. */
async function renewSession(ticket: string | undefined) {
  if (!ticket) return;
  const res = await signIn("credentials", { ticket, redirect: false });
  if (!res?.ok) toast.error("Per sicurezza accedi di nuovo.");
}

function recoveryFile(codes: string[], email: string) {
  return [
    "FinTrack · codici di recupero",
    `Account: ${email}`,
    `Creati il ${dateFormat.format(new Date())}`,
    "",
    "Ogni codice vale una volta sola, al posto del codice dell'app di autenticazione.",
    "Conservali lontano dal telefono: in un gestore di password o stampati in un cassetto.",
    "",
    ...codes.map((code, i) => `${String(i + 1).padStart(2, " ")}. ${code}`),
    "",
  ].join("\n");
}

function RecoveryCodes({
  codes,
  email,
  onDone,
}: {
  codes: string[];
  email: string;
  onDone: () => void;
}) {
  const [saved, setSaved] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success("Codici copiati");
    } catch {
      toast.error("Non riesco a copiarli: scaricali o scrivili a mano.");
    }
  }

  function download() {
    const blob = new Blob([recoveryFile(codes, email)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fintrack-codici-di-recupero.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4">
      <FormMessage tone="success">
        Salva questi codici adesso: non te li mostreremo più. Se perdi il telefono, ognuno ti fa
        entrare una volta al posto del codice dell&apos;app.
      </FormMessage>
      <ol className="bg-muted grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code} className="tabular-nums">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={copy}>
          <Copy /> Copia
        </Button>
        <Button type="button" variant="outline" onClick={download}>
          <Download /> Scarica (.txt)
        </Button>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="accent-primary mt-0.5 size-4 shrink-0"
        />
        <span>Li ho salvati in un posto sicuro</span>
      </label>
      <Button type="button" disabled={!saved} onClick={onDone} className="justify-self-end">
        Fatto
      </Button>
    </div>
  );
}

function EnableDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}) {
  const router = useRouter();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [result, setResult] = useState<SecurityResult | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);

  function close() {
    onOpenChange(false);
    setSetup(null);
    setResult(null);
    setCodes(null);
    router.refresh();
  }

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const res = await startTwoFactorSetup({ password }).catch(() => FAILED);
    setPending(false);
    if (res.ok) {
      setSetup(res);
      setResult(null);
    } else setResult(res);
  }

  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    const res = await confirmTwoFactorSetup({ code }).catch(() => FAILED);
    if (!res.ok || !res.codes) {
      setResult(res);
      setPending(false);
      return;
    }
    await renewSession(res.ticket);
    setPending(false);
    setResult(null);
    setCodes(res.codes);
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(setup?.secret?.replace(/\s/g, "") ?? "");
      toast.success("Chiave copiata");
    } catch {
      toast.error("Non riesco a copiarla: scrivila a mano.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !pending && !codes && (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {codes ? "I tuoi codici di recupero" : "Attiva la verifica in due passaggi"}
          </DialogTitle>
          <DialogDescription>
            {codes
              ? "La verifica in due passaggi è attiva."
              : setup
                ? "Inquadra il codice QR con l'app di autenticazione, poi scrivi il codice di 6 cifre che ti mostra."
                : "Oltre alla password, per entrare servirà un codice che cambia ogni 30 secondi, generato da un'app sul tuo telefono."}
          </DialogDescription>
        </DialogHeader>

        {codes ? (
          <RecoveryCodes codes={codes} email={email} onDone={close} />
        ) : setup ? (
          <form onSubmit={onCode} className="grid gap-4" noValidate>
            {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
            <div className="flex justify-center">
              {/* White background whatever the theme: phone cameras need the contrast. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qr ?? "")}`}
                alt="Codice QR da inquadrare con l'app di autenticazione"
                width={192}
                height={192}
                className="rounded-lg bg-white p-1"
              />
            </div>
            <div className="grid gap-1 text-sm">
              <p className="text-muted-foreground">
                Non riesci a inquadrarlo? Nell&apos;app scegli «Inserisci una chiave» e scrivi:
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-muted flex-1 rounded-md px-2 py-1.5 font-mono text-xs break-all">
                  {setup.secret}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyKey}
                  aria-label="Copia la chiave"
                >
                  <Copy />
                </Button>
              </div>
              {setup.uri && (
                <a
                  href={setup.uri}
                  className="text-primary underline-offset-4 hover:underline sm:hidden"
                >
                  Sei sul telefono? Apri direttamente nell&apos;app
                </a>
              )}
            </div>
            <FormField
              label="Codice di 6 cifre"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="123456"
              className="text-center font-mono text-lg tracking-[0.3em]"
              errors={result?.fieldErrors?.code}
              autoFocus
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Verifica…" : "Verifica e attiva"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onPassword} className="grid gap-4" noValidate>
            {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
            <div className="text-muted-foreground grid gap-2 text-sm">
              <p className="flex gap-2">
                <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Ti serve un&apos;app di autenticazione: Google Authenticator, Microsoft
                  Authenticator, oppure il gestore di password che già usi (1Password, Bitwarden,
                  Password di Apple).
                </span>
              </p>
              <p className="flex gap-2">
                <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Riceverai anche 10 codici di recupero, per entrare se perdi il telefono.
                </span>
              </p>
            </div>
            <PasswordField
              label="Per iniziare, la tua password"
              name="password"
              autoComplete="current-password"
              errors={result?.fieldErrors?.password}
              autoFocus
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Un attimo…" : "Continua"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Password + code dialogs: turning 2FA off, or replacing the recovery codes. */
function ConfirmDialog({
  mode,
  onClose,
  email,
}: {
  mode: "disable" | "codes" | null;
  onClose: () => void;
  email: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<SecurityResult | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);

  function close() {
    onClose();
    setResult(null);
    setCodes(null);
    router.refresh();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const input = {
      password: String(form.get("password") ?? ""),
      code: String(form.get("code") ?? ""),
    };
    const res = await (
      mode === "disable" ? disableTwoFactor(input) : regenerateRecoveryCodes(input)
    ).catch(() => FAILED);
    if (!res.ok) {
      setResult(res);
      setPending(false);
      return;
    }
    await renewSession(res.ticket);
    setPending(false);
    if (res.codes) {
      setResult(null);
      setCodes(res.codes);
      return;
    }
    toast.success("Verifica in due passaggi disattivata");
    close();
  }

  return (
    <Dialog open={mode !== null} onOpenChange={(next) => !next && !pending && !codes && close()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "disable"
              ? "Disattivare la verifica in due passaggi?"
              : "Nuovi codici di recupero"}
          </DialogTitle>
          <DialogDescription>
            {codes
              ? "I codici di prima non valgono più."
              : mode === "disable"
                ? "Per entrare basterà di nuovo la password: chi la scopre può entrare nel tuo account. Ti consigliamo di tenerla attiva."
                : "Creiamo 10 codici nuovi e quelli di prima smettono di funzionare."}
          </DialogDescription>
        </DialogHeader>
        {codes ? (
          <RecoveryCodes codes={codes} email={email} onDone={close} />
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
            <PasswordField
              label="Password"
              name="password"
              autoComplete="current-password"
              errors={result?.fieldErrors?.password}
              autoFocus
            />
            <FormField
              label="Codice dell'app o codice di recupero"
              name="code"
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              errors={result?.fieldErrors?.code}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={close}>
                Annulla
              </Button>
              <Button
                type="submit"
                variant={mode === "disable" ? "destructive" : "default"}
                disabled={pending}
              >
                {pending ? "Un attimo…" : mode === "disable" ? "Disattiva" : "Crea codici nuovi"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  open,
  onOpenChange,
  twoFactor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  twoFactor: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<SecurityResult | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await changePassword({
      current: String(form.get("current") ?? ""),
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
      code: twoFactor ? String(form.get("code") ?? "") : undefined,
    }).catch(() => FAILED);
    if (!res.ok) {
      setResult(res);
      setPending(false);
      return;
    }
    await renewSession(res.ticket);
    setPending(false);
    setResult(null);
    onOpenChange(false);
    toast.success("Password cambiata: gli altri dispositivi sono stati disconnessi");
    router.refresh();
  }

  const errors = result?.fieldErrors;
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambia password</DialogTitle>
          <DialogDescription>
            Dopo il cambio chiudiamo le sessioni aperte sugli altri dispositivi: lì dovrai accedere
            di nuovo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
          <PasswordField
            label="Password attuale"
            name="current"
            autoComplete="current-password"
            errors={errors?.current}
            autoFocus
          />
          <PasswordField
            label="Nuova password"
            name="password"
            autoComplete="new-password"
            placeholder="Almeno 10 caratteri"
            errors={errors?.password}
          />
          <PasswordField
            label="Ripeti la nuova password"
            name="confirmPassword"
            autoComplete="new-password"
            errors={errors?.confirmPassword}
          />
          {twoFactor && (
            <FormField
              label="Codice dell'app o codice di recupero"
              name="code"
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              errors={errors?.code}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvataggio…" : "Cambia password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SecuritySection({ info }: { info: SecurityInfo }) {
  const router = useRouter();
  const [enableOpen, setEnableOpen] = useState(false);
  const [confirm, setConfirm] = useState<"disable" | "codes" | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const on = info.twoFactorSince !== null;

  async function signOutOthers() {
    setSigningOut(true);
    const res = await signOutOtherDevices().catch(() => FAILED);
    if (res.ok) {
      await renewSession(res.ticket);
      toast.success("Fatto: sei connesso solo qui");
      router.refresh();
    } else toast.error(res.error ?? "Non riuscito. Riprova.");
    setSigningOut(false);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="flex items-center gap-2 font-medium">
            {on ? (
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <ShieldOff className="text-muted-foreground size-4" aria-hidden />
            )}
            Verifica in due passaggi
            <span
              className={
                "rounded-full px-2 py-0.5 text-xs font-medium " +
                (on
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300")
              }
            >
              {on ? "Attiva" : "Non attiva"}
            </span>
          </p>
          <p className="text-muted-foreground text-sm">
            {on
              ? `Attiva dal ${dateFormat.format(new Date(info.twoFactorSince!))}. ${
                  info.recoveryLeft === 0
                    ? "Non ti restano codici di recupero: creane di nuovi."
                    : `${info.recoveryLeft === 1 ? "Ti resta 1 codice" : `Ti restano ${info.recoveryLeft} codici`} di recupero.`
                }`
              : "Con la sola password, chi la scopre entra nei tuoi conti. Con la verifica in due passaggi serve anche il tuo telefono."}
          </p>
        </div>
        {on ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConfirm("codes")}>
              <RefreshCw /> Nuovi codici
            </Button>
            <Button variant="outline" onClick={() => setConfirm("disable")}>
              Disattiva
            </Button>
          </div>
        ) : (
          <Button onClick={() => setEnableOpen(true)}>
            <ShieldCheck /> Attivala ora
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-medium">
            <KeyRound className="size-4" aria-hidden /> Password
          </p>
          <p className="text-muted-foreground text-sm">
            Se pensi che qualcuno la conosca, cambiala: gli altri dispositivi verranno disconnessi.
          </p>
        </div>
        <Button variant="outline" onClick={() => setPasswordOpen(true)}>
          Cambia password
        </Button>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <LaptopMinimal className="size-4" aria-hidden /> Dispositivi
            </p>
            <p className="text-muted-foreground text-sm">
              Dove è stato fatto l&apos;accesso. Da uno nuovo ti mandiamo un&apos;email.
            </p>
          </div>
          <Button variant="outline" disabled={signingOut} onClick={signOutOthers}>
            <LogOut /> {signingOut ? "Un attimo…" : "Esci dagli altri dispositivi"}
          </Button>
        </div>
        {info.devices.length > 0 && (
          <ul className="divide-y rounded-lg border text-sm">
            {info.devices.map((d, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-3 py-2"
              >
                <span className="font-medium">
                  {d.label}
                  {d.current && (
                    <span className="bg-primary/10 text-primary ml-2 rounded-full px-2 py-0.5 text-xs">
                      questo
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  {d.place ? `${d.place} · ` : ""}ultimo accesso il{" "}
                  {dateTimeFormat.format(new Date(d.lastLoginAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EnableDialog open={enableOpen} onOpenChange={setEnableOpen} email={info.email} />
      <ConfirmDialog mode={confirm} onClose={() => setConfirm(null)} email={info.email} />
      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} twoFactor={on} />
    </div>
  );
}
