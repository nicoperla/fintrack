"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms/form-field";
import { cn } from "@/lib/utils";
import { setWeeklyDigest, updateProfile } from "./actions";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await updateProfile({
      name: new FormData(event.currentTarget).get("name"),
    }).catch(() => null);
    setPending(false);
    setErrors(res?.fieldErrors ?? {});
    if (res?.ok) toast.success("Profilo aggiornato");
    else if (!res?.fieldErrors) toast.error("Qualcosa è andato storto. Riprova.");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormField label="Nome" name="name" defaultValue={name} errors={errors.name} />
      <FormField
        label="Email"
        name="email"
        value={email}
        readOnly
        disabled
        hint="L'email è quella con cui accedi e non si può cambiare."
      />
      <Button type="submit" className="justify-self-start" disabled={pending}>
        {pending ? "Salvataggio…" : "Salva"}
      </Button>
    </form>
  );
}

export function DigestToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setPending(true);
    const res = await setWeeklyDigest(next).catch(() => null);
    setPending(false);
    if (res?.ok) {
      toast.success(next ? "Riepilogo settimanale attivato" : "Riepilogo settimanale disattivato");
    } else {
      setOn(!next);
      toast.error("Non sono riuscito a salvare. Riprova.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="digest-label" className="font-medium">
            Riepilogo settimanale via email
          </p>
          <p className="text-muted-foreground text-sm">
            Ogni lunedì mattina: quanto hai speso, le categorie principali, i budget a rischio e gli
            abbonamenti in arrivo.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="digest-label"
          onClick={toggle}
          disabled={pending}
          className={cn(
            "focus-visible:ring-ring/50 relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-3 disabled:cursor-wait",
            on ? "bg-primary" : "bg-input",
          )}
        >
          <span
            className={cn(
              "bg-background size-5 rounded-full shadow-sm transition-transform",
              on ? "translate-x-5.5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
      <a
        href="/api/digest/preview"
        target="_blank"
        rel="noopener"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 justify-self-start text-sm underline-offset-4 hover:underline"
      >
        Guarda un&apos;anteprima dell&apos;email <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </div>
  );
}
