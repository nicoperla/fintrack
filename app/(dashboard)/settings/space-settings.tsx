"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Crown, LogOut, Mail, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { CURRENCY_OPTIONS } from "@/lib/currency/currencies";
import type { ActionResult } from "@/lib/action-result";
import {
  inviteMember,
  leaveSpace,
  removeMember,
  renameSpace,
  revokeInvite,
  setSpaceCurrency,
  type InviteResult,
} from "./space-actions";

export type SpaceSettingsData = {
  name: string;
  currency: string;
  isOwner: boolean;
  currentUserId: string;
  members: { userId: string; name: string; email: string; role: "OWNER" | "MEMBER" }[];
  invites: { id: string; email: string; expiresAt: string }[];
};

const failed = (): ActionResult => ({ ok: false, error: "Operazione non riuscita. Riprova." });

const expiry = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" });

function SpaceDetails({ data }: { data: SpaceSettingsData }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const [currency, setCurrency] = useState(data.currency);
  const [confirmCurrency, setConfirmCurrency] = useState(false);

  async function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await renameSpace({ name: new FormData(event.currentTarget).get("name") }).catch(
      failed,
    );
    setPending(false);
    setResult(res);
    if (res.ok) toast.success("Nome aggiornato");
  }

  if (!data.isOwner) {
    return (
      <p className="text-muted-foreground text-sm">
        Valuta principale: <span className="text-foreground font-medium">{data.currency}</span>.
        Nome e valuta li può cambiare chi ha creato lo spazio.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={onRename} className="grid gap-3" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormField
              label="Nome dello spazio"
              name="name"
              defaultValue={data.name}
              maxLength={40}
              errors={result?.fieldErrors?.name}
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            Salva
          </Button>
        </div>
      </form>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <SelectField
            label="Valuta principale"
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            hint="Totali, budget, obiettivi e debiti sono espressi in questa valuta."
          >
            {CURRENCY_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </SelectField>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={currency === data.currency}
          onClick={() => setConfirmCurrency(true)}
          className="mb-6"
        >
          Cambia
        </Button>
      </div>
      <ConfirmDeleteDialog
        open={confirmCurrency}
        onOpenChange={setConfirmCurrency}
        title={`Passare da ${data.currency} a ${currency}?`}
        description="Ricalcoleremo ogni movimento con il cambio BCE del suo giorno, e convertiremo budget, obiettivi e debiti al cambio di oggi. I saldi dei conti restano nella loro valuta."
        successMessage={`Valuta principale: ${currency}`}
        confirmLabel={`Passa a ${currency}`}
        destructive={false}
        onConfirm={() => setSpaceCurrency({ currency })}
      />
    </div>
  );
}

function Members({ data }: { data: SpaceSettingsData }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<SpaceSettingsData["members"][number] | null>(null);
  const [leaving, setLeaving] = useState(false);

  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium">Persone</h3>
      <ul className="divide-y rounded-xl border">
        {data.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 px-3 py-2.5">
            <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium uppercase">
              {m.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name}
                {m.userId === data.currentUserId && (
                  <span className="text-muted-foreground font-normal"> (tu)</span>
                )}
              </p>
              <p className="text-muted-foreground truncate text-xs">{m.email}</p>
            </div>
            {m.role === "OWNER" ? (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Crown className="size-3.5" aria-hidden /> Proprietario
              </span>
            ) : data.isOwner ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Rimuovi ${m.name}`}
                onClick={() => setRemoving(m)}
              >
                <UserMinus />
              </Button>
            ) : m.userId === data.currentUserId ? (
              <Button variant="ghost" size="sm" onClick={() => setLeaving(true)}>
                <LogOut data-icon="inline-start" /> Esci
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <ConfirmDeleteDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Rimuovere ${removing?.name} dallo spazio?`}
        description="Non vedrà più i dati di questo spazio. I movimenti che ha registrato restano."
        successMessage="Persona rimossa"
        confirmLabel="Rimuovi"
        onConfirm={() => removeMember(removing!.userId)}
      />
      <ConfirmDeleteDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={`Uscire da «${data.name}»?`}
        description="Non vedrai più i dati di questo spazio e tornerai al tuo spazio personale. Per rientrare servirà un nuovo invito."
        successMessage="Sei uscito dallo spazio"
        confirmLabel="Esci dallo spazio"
        onConfirm={leaveSpace}
        onDeleted={() => router.push("/dashboard")}
      />
    </div>
  );
}

function Invites({ data }: { data: SpaceSettingsData }) {
  const [result, setResult] = useState<InviteResult | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    const res = await inviteMember({ email: new FormData(form).get("email") }).catch(failed);
    setPending(false);
    setResult(res);
    setCopied(false);
    if (res.ok) {
      form.reset();
      toast.success("Invito creato");
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      toast.error("Copia non riuscita: seleziona il link e copialo a mano.");
    }
  }

  if (!data.isOwner) return null;

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-medium">Invita qualcuno</h3>
      <form onSubmit={onInvite} className="grid gap-2" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <FormField
              label="Email"
              name="email"
              type="email"
              placeholder="nome@esempio.it"
              errors={result?.fieldErrors?.email}
            />
          </div>
          <Button type="submit" disabled={pending} className="mt-7">
            <Mail data-icon="inline-start" /> Invita
          </Button>
        </div>
      </form>
      {result?.ok && result.link && (
        <div className="bg-muted/60 grid gap-2 rounded-xl p-3 text-sm">
          <p>
            Abbiamo mandato il link via email. Puoi anche condividerlo tu (vale 7 giorni e solo per
            quell&apos;indirizzo):
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-background min-w-0 flex-1 truncate rounded-md border px-2 py-1 text-xs">
              {result.link}
            </code>
            <Button variant="outline" size="sm" onClick={() => copy(result.link!)}>
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copied ? "Copiato" : "Copia"}
            </Button>
          </div>
        </div>
      )}
      {data.invites.length > 0 && (
        <ul className="grid gap-1">
          {data.invites.map((invite) => (
            <li key={invite.id} className="flex items-center gap-2 text-sm">
              <Mail className="text-muted-foreground size-4" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{invite.email}</span>
              <span className="text-muted-foreground text-xs">
                in attesa · scade il {expiry.format(new Date(invite.expiresAt))}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Annulla l'invito a ${invite.email}`}
                onClick={async () => {
                  const res = await revokeInvite(invite.id).catch(failed);
                  if (res.ok) toast.success("Invito annullato");
                }}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SpaceSettings({ data }: { data: SpaceSettingsData }) {
  return (
    <div className="grid gap-5">
      <SpaceDetails data={data} />
      <Members data={data} />
      <Invites data={data} />
    </div>
  );
}
