"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Copy, Link2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { createFamilyShare, revokeFamilyShare } from "@/app/(dashboard)/fascicolo/actions";
import { MAX_ACTIVE_SHARES, SHARE_DAYS } from "@/lib/family-file";
import type { FamilyShare } from "@/lib/data/family-file";
import type { ActionResult } from "@/lib/action-result";

const dateTime = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});
const date = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Rome",
});

export function SharePanel({
  shares,
  owner,
  pro,
}: {
  shares: FamilyShare[];
  /** Only the owner shares the space's data outside it. */
  owner: boolean;
  pro: boolean;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    const res = await createFamilyShare({
      label: String(data.get("label") ?? ""),
      days: String(data.get("days") ?? ""),
      showAmounts: data.get("showAmounts") === "on",
    }).catch((): ActionResult & { link?: string } => ({
      ok: false,
      error: "Non sono riuscito a creare il link.",
    }));
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    setResult(null);
    setLink(res.link ?? null);
    form.reset();
  }

  async function revoke(id: string) {
    const res = await revokeFamilyShare(id).catch((): ActionResult => ({ ok: false }));
    if (res.ok) toast.success("Link revocato: non funziona più");
    else toast.error(res.error ?? "Non sono riuscito a revocarlo. Riprova.");
  }

  function copy() {
    if (!link) return;
    navigator.clipboard
      .writeText(link)
      .then(() => toast.success("Link copiato"))
      .catch(() => toast.error("Copia non riuscita: selezionalo e copialo a mano"));
  }

  return (
    <section
      aria-labelledby="condividi-title"
      className="bg-card grid grid-cols-1 gap-4 rounded-2xl border p-5"
    >
      <div>
        <h2 id="condividi-title" className="flex items-center gap-2 font-medium">
          <Link2 className="size-4" aria-hidden /> Per la persona di cui ti fidi
        </h2>
        <p className="text-muted-foreground text-sm">
          Un link da mandare a chi deve sapere: si apre senza account, scade da solo e puoi
          revocarlo quando vuoi. Di base mostra dove sono le cose, non quanto c&apos;è.
        </p>
      </div>

      {link && (
        <div className="grid gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
          <p className="font-medium">
            Ecco il link. Copialo adesso: per sicurezza non lo mostro più.
          </p>
          <p className="bg-background rounded-lg border p-2 font-mono text-xs break-all">{link}</p>
          <div>
            <Button type="button" size="sm" onClick={copy}>
              <Copy /> Copia il link
            </Button>
          </div>
        </div>
      )}

      {!pro ? (
        <Link
          href="/settings#abbonamento"
          className="bg-muted/50 hover:bg-muted flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm"
        >
          <Lock className="size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">La condivisione fa parte di FinTrack Pro.</span>{" "}
            <span className="text-muted-foreground">Le note e il riepilogo restano gratuiti.</span>
          </span>
        </Link>
      ) : !owner ? (
        <p className="text-muted-foreground text-sm">
          Solo chi ha creato lo spazio può condividerne il fascicolo. Puoi però revocare i link qui
          sotto.
        </p>
      ) : shares.length >= MAX_ACTIVE_SHARES ? (
        <p className="text-muted-foreground text-sm">
          Ci sono già {MAX_ACTIVE_SHARES} link attivi: revocane uno per crearne un altro.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
          {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Per chi è"
              name="label"
              placeholder="Es. Marco, mio fratello"
              maxLength={60}
              errors={result?.fieldErrors?.label}
            />
            <SelectField
              label="Funziona per"
              name="days"
              defaultValue="7"
              errors={result?.fieldErrors?.days}
            >
              {SHARE_DAYS.map((d) => (
                <NativeSelectOption key={d} value={d}>
                  {d} giorni
                </NativeSelectOption>
              ))}
            </SelectField>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="showAmounts" className="accent-primary mt-0.5 size-4" />
            <span>
              Mostra anche gli importi
              <span className="text-muted-foreground block text-xs">
                Saldi, debiti e addebiti con le cifre. Senza, la mappa basta a sapere dove cercare.
              </span>
            </span>
          </label>
          <div>
            <Button type="submit" disabled={pending}>
              <Link2 /> {pending ? "Un attimo…" : "Crea il link"}
            </Button>
          </div>
        </form>
      )}

      {shares.length > 0 && (
        <div className="grid gap-2 border-t pt-4">
          <p className="text-sm font-medium">Link attivi</p>
          <ul className="divide-y text-sm">
            {shares.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.label}</p>
                  <p className="text-muted-foreground text-xs">
                    Scade il {date.format(new Date(s.expiresAt))}
                    {s.showAmounts ? " · con gli importi" : ""} ·{" "}
                    {s.views === 0
                      ? "non ancora aperto"
                      : `aperto ${s.views === 1 ? "1 volta" : `${s.views} volte`}, l'ultima il ${dateTime.format(new Date(s.lastViewedAt!))}`}
                  </p>
                </div>
                <Button type="button" size="xs" variant="outline" onClick={() => revoke(s.id)}>
                  Revoca
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
