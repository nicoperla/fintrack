"use client";

import { Fragment, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleCheck,
  Copy,
  Download,
  Info,
  Lock,
  Mail,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { ClaimKind } from "@prisma/client";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormMessage, SelectField, TextareaField } from "@/components/forms/form-field";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { maskAmounts } from "@/components/amount";
import { useAmountsHidden, useMoney } from "@/components/currency-provider";
import {
  CLAIMS_DISCLAIMER,
  KindIcon,
  STATUS_LABELS,
  StatusBadge,
  StepNote,
} from "@/components/claims/claim-ui";
import {
  deleteClaim,
  markClaimSent,
  recordClaimOutcome,
  reopenClaim,
  updateClaimLetter,
} from "@/app/(dashboard)/ritrovati/pratiche/actions";
import {
  CHANNEL_LABELS,
  CLAIM_CHANNELS,
  KIND_LABELS,
  OUTCOME_STATUSES,
  findingKey,
  formatClaimDate,
  isOpenClaim,
  type ChargeAfterCancellation,
  type ClaimChannel,
  type ClaimOutcome,
} from "@/lib/finance/claims";
import { missingDetails } from "@/lib/claims/letters";
import type { ClaimWithStep } from "@/lib/data/claims";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const ABF_URL = "https://www.arbitrobancariofinanziario.it";

const GOOD_TO_KNOW: Record<ClaimKind, string[]> = {
  CANCELLATION: [
    "Se ti sei abbonato online, dal 19 giugno 2026 il sito deve offrirti una funzione per recedere facile quanto l'abbonamento.",
    "Conserva la conferma della disdetta: se ti addebitano ancora qualcosa, ti serve per chiedere il rimborso.",
  ],
  DIRECT_DEBIT_REFUND: [
    "Entro 8 settimane dall'addebito la banca deve rimborsarti senza chiederti il motivo (artt. 13 e 14 del d.lgs. 11/2010, regole SEPA Core).",
    "Dopo le 8 settimane, un addebito che non hai mai autorizzato si può ancora contestare entro 13 mesi.",
    "Molte banche accettano la richiesta anche dall'app o dall'home banking: cerca «rimborso addebito diretto» o «storno SDD».",
  ],
  BANK_COMPLAINT: [
    "Il reclamo va all'ufficio reclami della banca: l'indirizzo, spesso una PEC, è sul sito, nella sezione Reclami o Trasparenza.",
    "La banca deve risponderti entro 15 giornate operative per i servizi di pagamento, entro 60 giorni negli altri casi.",
    "Se non risponde in tempo, o la risposta non ti convince, puoi ricorrere all'Arbitro Bancario Finanziario: costa 20 €, che ti vengono restituiti se hai ragione.",
  ],
  DUPLICATE_CHARGE: [
    "Scrivi prima al negozio, con lo scontrino o il numero d'ordine.",
    "Se non risolve, contesta l'addebito con la tua banca: per le carte, prima lo fai e meglio è.",
  ],
};

const OUTCOME_LABELS: Record<"cancellation" | "money", Record<ClaimOutcome, string>> = {
  cancellation: {
    WON: "Disdetta confermata",
    PARTIAL: "Confermata, ma con dei costi",
    LOST: "Non me l'hanno accettata",
    DROPPED: "Ci ho rinunciato",
  },
  money: {
    WON: "Ho riavuto tutto",
    PARTIAL: "Ho riavuto una parte",
    LOST: "Mi hanno detto di no",
    DROPPED: "Ci ho rinunciato",
  },
};

const toInput = (n: number) => n.toFixed(2).replace(".", ",");
const failed = (): ActionResult => ({ ok: false, error: "Operazione non riuscita. Riprova." });
const channelLabel = (channel: string | null) =>
  channel ? (CHANNEL_LABELS[channel as ClaimChannel] ?? channel) : null;

function Progress({ claim }: { claim: ClaimWithStep }) {
  const closed = !isOpenClaim(claim.status);
  const steps = [
    { label: "Lettera pronta", done: true, detail: formatClaimDate(claim.openedOn) },
    {
      label: "Inviata",
      done: claim.sentAt !== null,
      detail: claim.sentAt
        ? [formatClaimDate(claim.sentAt), channelLabel(claim.channel)].filter(Boolean).join(" · ")
        : null,
    },
    { label: "Esito", done: closed, detail: closed ? STATUS_LABELS[claim.status] : null },
  ];
  return (
    <ol className="grid grid-cols-3 gap-2 text-sm" aria-label="Avanzamento della pratica">
      {steps.map((s, i) => (
        <li
          key={s.label}
          className={cn(
            "grid content-start gap-1 rounded-xl border p-3",
            s.done ? "border-emerald-500/40 bg-emerald-500/5" : "border-dashed",
          )}
        >
          <span className="flex items-center gap-1.5 font-medium">
            {s.done ? (
              <CircleCheck
                className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
            ) : (
              <span className="text-muted-foreground w-4 text-center tabular-nums">{i + 1}</span>
            )}
            {s.label}
          </span>
          {s.detail && <span className="text-muted-foreground text-xs">{s.detail}</span>}
        </li>
      ))}
    </ol>
  );
}

function ChargesAfter({ charges }: { charges: ChargeAfterCancellation[] }) {
  const money = useMoney();
  return (
    <ul className="bg-background/60 text-foreground divide-y rounded-lg border text-sm">
      {charges.map((c) => (
        <li key={c.transactionId} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {money(c.amount)} il {formatClaimDate(c.date)}
            </p>
            <p className="text-muted-foreground text-xs">
              {c.description} · rimborso entro il {formatClaimDate(c.refundBy)}
            </p>
          </div>
          <Link
            href={`/ritrovati/pratiche/nuova?ritrovato=${encodeURIComponent(findingKey.after(c.transactionId))}`}
            className={buttonVariants({ size: "sm" })}
          >
            Chiedi il rimborso
          </Link>
        </li>
      ))}
    </ul>
  );
}

function LetterCard({ claim, pro }: { claim: ClaimWithStep; pro: boolean }) {
  const editable = claim.status === "DRAFT";
  const hidden = useAmountsHidden();
  const [subject, setSubject] = useState(claim.subject);
  const [body, setBody] = useState(claim.body);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const dirty = subject !== claim.subject || body !== claim.body;
  const missing = missingDetails(body);

  async function save() {
    setSaving(true);
    const res = await updateClaimLetter(claim.id, { subject, body }).catch(failed);
    setSaving(false);
    setResult(res.ok ? null : res);
    if (res.ok) toast.success("Lettera salvata");
  }

  function copy() {
    navigator.clipboard
      .writeText(body)
      .then(() => toast.success("Testo copiato"))
      .catch(() => toast.error("Copia non riuscita"));
  }

  return (
    <section className="bg-card grid gap-4 rounded-2xl border p-5" aria-labelledby="letter-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="letter-title" className="font-medium">
            La lettera
          </h2>
          <p className="text-muted-foreground text-sm">
            {editable
              ? "Rileggila, correggila se serve e inviala dalla tua email, via PEC o per raccomandata."
              : "Il testo che hai inviato."}
          </p>
        </div>
      </div>

      {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}

      {editable ? (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="letter-subject">Oggetto</Label>
            <Input
              id="letter-subject"
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
              aria-invalid={result?.fieldErrors?.subject ? true : undefined}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="letter-body">Testo</Label>
            <Textarea
              id="letter-body"
              value={body}
              rows={16}
              maxLength={8000}
              onChange={(e) => setBody(e.target.value)}
              className="text-sm leading-relaxed"
              aria-invalid={result?.fieldErrors?.body ? true : undefined}
            />
          </div>
        </div>
      ) : (
        <div className="bg-muted/30 rounded-xl border p-4">
          <p className="text-sm font-medium">
            Oggetto: {hidden ? maskAmounts(claim.subject) : claim.subject}
          </p>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
            {hidden ? maskAmounts(claim.body) : claim.body}
          </p>
        </div>
      )}

      {editable && missing.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-(--warn-text)">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Nella tua email, prima di inviarla, completa: {missing.join(" · ")}. Qui puoi lasciarli
            così: FinTrack non salva i tuoi dati bancari.
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button onClick={save} disabled={!dirty || saving}>
            <Save /> {saving ? "Salvataggio…" : dirty ? "Salva le modifiche" : "Salvata"}
          </Button>
        )}
        <Button variant="outline" onClick={copy}>
          <Copy /> Copia il testo
        </Button>
        <a
          href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <Mail /> Apri nell&apos;email
        </a>
        {pro ? (
          dirty ? (
            <Button variant="outline" disabled>
              <Download /> Salva per scaricare il PDF
            </Button>
          ) : (
            <a
              href={`/api/ritrovati/pratiche/${claim.id}/pdf`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Download /> PDF per la raccomandata
            </a>
          )
        ) : (
          <Link href="/settings#abbonamento" className={buttonVariants({ variant: "ghost" })}>
            <Lock /> PDF con Pro
          </Link>
        )}
      </div>
    </section>
  );
}

function SentForm({
  claim,
  today,
  onDone,
}: {
  claim: ClaimWithStep;
  today: string;
  onDone: () => void;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const cancellation = claim.kind === "CANCELLATION";
  const toBank = claim.kind === "DIRECT_DEBIT_REFUND" || claim.kind === "BANK_COMPLAINT";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    setPending(true);
    const res = await markClaimSent(claim.id, {
      channel: text("channel"),
      sentAt: text("sentAt"),
      effectiveFrom: cancellation ? text("effectiveFrom") : "",
    }).catch(failed);
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success("Segnata come inviata: le scadenze le conto io");
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
      <SelectField
        label="Come l'hai inviata"
        name="channel"
        defaultValue={toBank ? "pec" : "email"}
        errors={result?.fieldErrors?.channel}
      >
        {CLAIM_CHANNELS.map((c) => (
          <NativeSelectOption key={c} value={c}>
            {CHANNEL_LABELS[c]}
          </NativeSelectOption>
        ))}
      </SelectField>
      <FormField
        label="Quando"
        name="sentAt"
        type="date"
        defaultValue={today}
        max={today}
        errors={result?.fieldErrors?.sentAt}
      />
      {cancellation && (
        <FormField
          label="Da quando non devono più addebitarti niente"
          name="effectiveFrom"
          type="date"
          defaultValue={claim.effectiveFrom ?? ""}
          hint="Di solito la fine del periodo già pagato. Se dopo questa data arriva un addebito, te lo segnalo."
          errors={result?.fieldErrors?.effectiveFrom}
        />
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Annulla
        </Button>
        <Button type="submit" disabled={pending}>
          <Send /> {pending ? "Un attimo…" : "Segna come inviata"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function OutcomeForm({ claim, onDone }: { claim: ClaimWithStep; onDone: () => void }) {
  const cancellation = claim.kind === "CANCELLATION";
  const labels = OUTCOME_LABELS[cancellation ? "cancellation" : "money"];
  const [status, setStatus] = useState<ClaimOutcome>("WON");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const gotSomething = status === "WON" || status === "PARTIAL";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const res = await recordClaimOutcome(claim.id, {
      status,
      recoveredAmount: gotSomething ? String(form.get("recoveredAmount") ?? "") : "",
      notes: String(form.get("notes") ?? ""),
    }).catch(failed);
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success(
      gotSomething
        ? cancellation
          ? "Disdetta confermata: soldi che restano a te"
          : "Soldi recuperati, ottimo!"
        : "Pratica chiusa",
    );
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
      <fieldset className="grid gap-2">
        <legend className="sr-only">Esito</legend>
        {OUTCOME_STATUSES.map((s) => (
          <label
            key={s}
            className={cn(
              "has-focus-visible:ring-ring/50 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-focus-visible:ring-3",
              status === s
                ? "border-emerald-500/60 bg-emerald-500/5 font-medium"
                : "hover:bg-muted/50",
            )}
          >
            <input
              type="radio"
              name="status"
              value={s}
              checked={status === s}
              onChange={() => setStatus(s)}
              className="accent-emerald-600"
            />
            {labels[s]}
          </label>
        ))}
      </fieldset>
      {gotSomething && (
        <FormField
          key={status}
          label={cancellation ? "Quanto risparmi in un anno (€)" : "Quanto hai recuperato (€)"}
          name="recoveredAmount"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={status === "WON" ? toInput(claim.expectedAmount) : ""}
          errors={result?.fieldErrors?.recoveredAmount}
        />
      )}
      <TextareaField
        label="Note (facoltative)"
        name="notes"
        rows={2}
        maxLength={500}
        placeholder="Es. rimborso arrivato il 12 novembre con un bonifico"
        defaultValue={claim.notes ?? ""}
        errors={result?.fieldErrors?.notes}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Annulla
        </Button>
        <Button type="submit" disabled={pending}>
          <Check /> {pending ? "Un attimo…" : "Chiudi la pratica"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Details({ claim }: { claim: ClaimWithStep }) {
  const money = useMoney();
  const tx = claim.transaction;
  const cancellation = claim.kind === "CANCELLATION";
  const rows: [string, ReactNode][] = [
    ["Tipo", KIND_LABELS[claim.kind]],
    [cancellation ? "Costo in un anno" : "Importo", money(claim.expectedAmount)],
  ];
  if (tx) {
    rows.push([
      "Movimento",
      <Link
        key="tx"
        href={`/transactions?${new URLSearchParams({ q: tx.description })}`}
        className="hover:underline"
      >
        {tx.description} · {formatClaimDate(tx.date)} · {tx.account}
      </Link>,
    ]);
  }
  if (claim.sentAt) {
    rows.push([
      "Inviata",
      [formatClaimDate(claim.sentAt), channelLabel(claim.channel)].filter(Boolean).join(" · "),
    ]);
  }
  if (claim.effectiveFrom) rows.push(["Disdetta dal", formatClaimDate(claim.effectiveFrom)]);
  if (claim.deadline && isOpenClaim(claim.status)) {
    rows.push([
      claim.status === "DRAFT" ? "Da inviare entro" : "Risposta attesa entro",
      formatClaimDate(claim.deadline),
    ]);
  }
  if (claim.recoveredAmount !== null) {
    rows.push([cancellation ? "Risparmio in un anno" : "Recuperati", money(claim.recoveredAmount)]);
  }
  if (claim.closedAt) rows.push(["Chiusa il", formatClaimDate(claim.closedAt)]);
  if (claim.notes) rows.push(["Note", claim.notes]);

  return (
    <section className="bg-card rounded-2xl border p-5" aria-labelledby="details-title">
      <h2 id="details-title" className="mb-3 font-medium">
        Dettagli
      </h2>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}

function GoodToKnow({ kind }: { kind: ClaimKind }) {
  return (
    <section
      className="bg-muted/30 grid gap-2 rounded-2xl border p-5 text-sm"
      aria-labelledby="tips-title"
    >
      <h2 id="tips-title" className="flex items-center gap-2 font-medium">
        <Info className="size-4" aria-hidden /> Da sapere
      </h2>
      <ul className="text-muted-foreground grid list-disc gap-1.5 pl-5">
        {GOOD_TO_KNOW[kind].map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      {kind === "BANK_COMPLAINT" && (
        <a
          href={ABF_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="justify-self-start text-sm font-medium underline-offset-4 hover:underline"
        >
          Il sito dell&apos;Arbitro Bancario Finanziario
        </a>
      )}
    </section>
  );
}

export function ClaimDetail({
  claim,
  chargesAfter,
  pro,
  today,
}: {
  claim: ClaimWithStep;
  chargesAfter: ChargeAfterCancellation[];
  pro: boolean;
  today: string;
}) {
  const money = useMoney();
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reopening, startReopen] = useTransition();
  const open = isOpenClaim(claim.status);
  const cancellation = claim.kind === "CANCELLATION";
  const amount =
    !open && claim.recoveredAmount !== null ? claim.recoveredAmount : claim.expectedAmount;
  const escalate = claim.step.escalate;

  function reopen() {
    startReopen(async () => {
      const res = await reopenClaim(claim.id).catch(failed);
      if (res.ok) toast.success("Pratica riaperta");
      else toast.error(res.error ?? "Operazione non riuscita. Riprova.");
    });
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start gap-4">
        <KindIcon kind={claim.kind} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-sm">{KIND_LABELS[claim.kind]}</p>
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {claim.counterparty}
          </h1>
          <p className="text-muted-foreground text-sm">
            Aperta il {formatClaimDate(claim.openedOn)}
          </p>
        </div>
        <div className="grid justify-items-end gap-1 text-right">
          <p className="text-2xl font-semibold tabular-nums">
            {money(amount)}
            {cancellation && <span className="text-sm font-normal">/anno</span>}
          </p>
          <StatusBadge status={claim.status} />
        </div>
      </header>

      <Progress claim={claim} />

      <StepNote step={claim.step}>
        {escalate === "BANK_COMPLAINT" && claim.transaction && (
          <Link
            href={`/ritrovati/pratiche/nuova?${new URLSearchParams({ movimento: claim.transaction.id, tipo: "BANK_COMPLAINT" })}`}
            className={cn(buttonVariants({ size: "sm" }), "justify-self-start")}
          >
            Prepara il reclamo alla banca
          </Link>
        )}
        {chargesAfter.length > 0 && <ChargesAfter charges={chargesAfter} />}
      </StepNote>

      <LetterCard key={`${claim.subject}\n${claim.body}`} claim={claim} pro={pro} />

      <div className="flex flex-wrap gap-2">
        {claim.status === "DRAFT" && (
          <Button onClick={() => setSending(true)}>
            <Send /> Segna come inviata
          </Button>
        )}
        {open ? (
          <Button
            variant={claim.status === "DRAFT" ? "outline" : "default"}
            onClick={() => setClosing(true)}
          >
            <Check /> Com&apos;è finita?
          </Button>
        ) : (
          <Button variant="outline" onClick={reopen} disabled={reopening}>
            <RotateCcw /> Riapri la pratica
          </Button>
        )}
        <Button variant="ghost" className="text-destructive" onClick={() => setDeleting(true)}>
          <Trash2 /> Elimina
        </Button>
      </div>

      <Details claim={claim} />
      <GoodToKnow kind={claim.kind} />
      <p className="text-muted-foreground text-xs">{CLAIMS_DISCLAIMER}</p>

      <Dialog open={sending} onOpenChange={setSending}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hai inviato la lettera?</DialogTitle>
            <DialogDescription>
              Dimmi come e quando: da lì conto i giorni che hanno per risponderti.
            </DialogDescription>
          </DialogHeader>
          {sending && <SentForm claim={claim} today={today} onDone={() => setSending(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Com&apos;è finita?</DialogTitle>
            <DialogDescription>
              {cancellation
                ? "Se la disdetta è confermata, quello che risparmi in un anno entra nel conto di Riprenditeli."
                : "Se ti hanno restituito i soldi, l'importo entra nel conto di Riprenditeli."}
            </DialogDescription>
          </DialogHeader>
          {closing && <OutcomeForm claim={claim} onDone={() => setClosing(false)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Eliminare la pratica?"
        description="La lettera e le date salvate andranno perse. I movimenti restano dove sono."
        successMessage="Pratica eliminata"
        onConfirm={() => deleteClaim(claim.id)}
        onDeleted={() => router.push("/ritrovati/pratiche")}
      />
    </div>
  );
}
