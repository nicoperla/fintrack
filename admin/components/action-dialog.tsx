"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui";
import { toast } from "@/components/toast";
import type { ActionResult } from "@/lib/action";

/**
 * A button that opens a confirmation dialog, with optional fields, and runs a server action.
 * On success it closes, notifies and refreshes the page; with `showCodes` it stays open to show
 * something once (recovery codes).
 */
export function ActionDialog({
  label,
  icon,
  variant = "secondary",
  small,
  disabled,
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  action,
  children,
  showCodes,
}: {
  label: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  small?: boolean;
  disabled?: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  action: (form: FormData) => Promise<ActionResult>;
  children?: ReactNode;
  /** Recovery codes returned by the action are shown once, in the dialog. */
  showCodes?: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ActionResult | null>(null);
  // A new key empties the fields each time the dialog opens.
  const [formKey, setFormKey] = useState(0);

  function openDialog() {
    setError(null);
    setSuccess(null);
    setFormKey((k) => k + 1);
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
    if (success) router.refresh();
    setSuccess(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result: ActionResult | undefined = await action(new FormData(event.currentTarget)).catch(
      (): ActionResult => ({ ok: false, error: "Operazione non riuscita. Riprova." }),
    );
    // An action that redirects (deleting a user) never returns a result: the page changes.
    if (!result) return;
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Operazione non riuscita.");
      return;
    }
    if (showCodes && result.codes) {
      setSuccess(result);
      return;
    }
    dialog.current?.close();
    toast(result.message ?? "Fatto");
    router.refresh();
  }

  return (
    <>
      <Button variant={variant} small={small} disabled={disabled} onClick={openDialog}>
        {icon}
        {label}
      </Button>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (pending) event.preventDefault();
          else if (success) {
            event.preventDefault();
            close();
          }
        }}
        className="border-line bg-panel m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border p-0 text-white shadow-2xl"
      >
        <div className="grid gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={close}
              disabled={pending}
              aria-label="Chiudi"
              className="text-muted rounded-md p-1 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
          {success?.codes ? (
            <RecoveryCodesView codes={success.codes} onDone={close} />
          ) : (
            <form key={formKey} onSubmit={onSubmit} className="grid gap-4">
              {description && <div className="text-muted text-sm">{description}</div>}
              {children}
              {error && (
                <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={close} disabled={pending}>
                  Annulla
                </Button>
                <Button type="submit" variant={confirmVariant} disabled={pending}>
                  {pending ? "Un attimo…" : confirmLabel}
                </Button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}

/** The ten recovery codes, with copy, shown right after they are created. */
export function RecoveryCodesView({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-4">
      <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
        Salvali adesso in un posto sicuro (un gestore di password): non li vedrai più. Ognuno ti fa
        entrare una volta se perdi il telefono.
      </p>
      <ol className="bg-ink grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(codes.join("\n")).catch(() => {});
            setCopied(true);
          }}
        >
          {copied ? "Copiati" : "Copia"}
        </Button>
        <Button type="button" variant="primary" onClick={onDone}>
          Li ho salvati
        </Button>
      </div>
    </div>
  );
}
