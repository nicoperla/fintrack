"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";
import { toast } from "sonner";
import { resendVerificationEmail } from "@/app/(dashboard)/settings/account-actions";

/** Until the email is confirmed: a reminder, with a button to get a new link. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    const res = await resendVerificationEmail().catch(() => null);
    setPending(false);
    if (res?.ok) toast.success(`Link inviato a ${email}`);
    else toast.error(res?.error ?? "Invio non riuscito. Riprova tra poco.");
  }

  return (
    <div className="border-b bg-amber-500/10">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <MailWarning className="size-4 shrink-0 text-(--warn-text)" aria-hidden />
        <p className="min-w-0 flex-1">
          Conferma la tua email: ti abbiamo mandato un link a{" "}
          <span className="font-medium">{email}</span>.
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={pending}
          className="font-medium underline underline-offset-4 disabled:opacity-60"
        >
          {pending ? "Invio…" : "Rinvia il link"}
        </button>
      </div>
    </div>
  );
}
