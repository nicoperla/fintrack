"use client";

import { useState, type FormEvent } from "react";
import { Archive, CircleCheckBig, HandCoins, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaxSection, TONE_BOX, TONE_TEXT, useAction } from "@/components/tax/ui";
import { markRefundReceived, saveResult } from "@/app/(dashboard)/730/actions";
import { DEDUCTION_TYPES, RULES, type DeductionType } from "@/lib/finance/deductions";
import { parseAmount } from "@/lib/finance/money";
import { correctionPaths, describeTiming, keepUntil, longDay } from "@/lib/tax/calendar";
import type { ActionResult } from "@/lib/action-result";
import type { My730 } from "@/lib/data/my730";
import { cn } from "@/lib/utils";

const toInput = (n: number | null) => (n === null || n === 0 ? "" : n.toFixed(2).replace(".", ","));

/**
 * After sending: the result of the 730-3, when the money arrives (or is taken), the November
 * advance, the check of the CAF's work, how to fix a mistake and what to keep.
 */
export function AfterCard({ data }: { data: My730 }) {
  const money = useMoney();
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(data.result === null);
  const [direction, setDirection] = useState<"refund" | "debt" | "zero">(
    data.result === null
      ? "refund"
      : data.result > 0
        ? "refund"
        : data.result < 0
          ? "debt"
          : "zero",
  );
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const corrections = correctionPaths(data.rules, data.today, data.channel);
  const keep = keepUntil(data.year);
  const throwAway = Number(data.today.slice(0, 4)) - 7;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const res = await saveResult(data.year, {
      direction,
      amount: String(form.get("amount") ?? ""),
      secondAdvance: String(form.get("secondAdvance") ?? ""),
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setSaving(false);
    setErrors(res.fieldErrors ?? {});
    if (res.ok) {
      toast.success("Salvato");
      setEditing(false);
    } else if (res.error) toast.error(res.error);
  }

  const timing = data.timing ? describeTiming(data.timing) : null;
  const dueMonth = data.timing?.kind === "pay" ? data.timing.to : null;
  const late =
    dueMonth !== null &&
    data.timing?.kind === "pay" &&
    data.today > `${data.timing.year}-${String(dueMonth).padStart(2, "0")}-28`;

  return (
    <TaxSection
      id="dopo"
      icon={HandCoins}
      title="Dopo l'invio"
      subtitle="Quando arrivano i soldi, cosa ti tratterranno e cosa conservare."
    >
      {!data.sentAt ? (
        <p className="text-muted-foreground text-sm">
          Quando l&apos;hai inviato, segnalo nella sezione dell&apos;invio: da lì ti seguo fino ai
          soldi sul conto.
        </p>
      ) : editing ? (
        <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border p-4" noValidate>
          <p className="text-sm">
            Scrivi il risultato del prospetto di liquidazione (730-3): lo trovi nella ricevuta
            dell&apos;Agenzia o nei fogli del CAF.
          </p>
          <div
            className="bg-muted inline-flex w-fit rounded-lg p-0.5 text-sm"
            role="group"
            aria-label="Risultato"
          >
            {(
              [
                ["refund", "Rimborso"],
                ["debt", "Debito"],
                ["zero", "Zero"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={direction === v}
                onClick={() => setDirection(v)}
                className={cn(
                  "rounded-md px-3 py-1",
                  direction === v && "bg-background font-medium shadow-sm",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {direction !== "zero" && (
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground text-xs">
                  {direction === "refund"
                    ? "Quanto ti torna (IRPEF e addizionali)"
                    : "Quanto devi (saldo e primo acconto)"}
                </span>
                <Input
                  name="amount"
                  inputMode="decimal"
                  placeholder="Es. 280"
                  defaultValue={toInput(data.result === null ? null : Math.abs(data.result))}
                  aria-invalid={errors.amount ? true : undefined}
                />
              </label>
            )}
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">
                Secondo acconto di novembre (se c&apos;è)
              </span>
              <Input
                name="secondAdvance"
                inputMode="decimal"
                placeholder="Es. 120"
                defaultValue={toInput(data.secondAdvance)}
                aria-invalid={errors.secondAdvance ? true : undefined}
              />
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvo…" : "Salva"}
            </Button>
          </div>
          {(errors.amount || errors.secondAdvance) && (
            <p className="text-destructive text-xs">
              {(errors.amount ?? errors.secondAdvance)![0]}
            </p>
          )}
        </form>
      ) : (
        <div
          className={cn(
            "grid gap-3 rounded-xl border p-4 text-sm",
            TONE_BOX[data.result! > 0 ? "good" : data.result! < 0 ? "warn" : "info"],
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground">
                {data.result! > 0 ? "Rimborso" : data.result! < 0 ? "Da pagare" : "Risultato"}
              </p>
              <p
                className={cn(
                  "text-3xl font-semibold tracking-tight tabular-nums",
                  TONE_TEXT[data.result! > 0 ? "good" : data.result! < 0 ? "warn" : "info"],
                )}
              >
                {money(Math.abs(data.result!))}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Modifica
            </Button>
          </div>
          {data.result! > 0 && (
            <>
              {data.refundReceivedAt ? (
                <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
                  <CircleCheckBig className="size-4" aria-hidden /> Arrivato il{" "}
                  {longDay(data.refundReceivedAt)}.
                </p>
              ) : data.refundSeen ? (
                <p>
                  Ho visto «{data.refundSeen.description}» del {longDay(data.refundSeen.date)}, di{" "}
                  {money(data.refundSeen.amount)}: è il rimborso?
                </p>
              ) : (
                <p>
                  Arriva {timing}.{" "}
                  {late &&
                    "Se non lo vedi ancora, chiedi all'ufficio del personale (o all'ente della pensione) se ha ricevuto il prospetto, poi controlla il Cassetto fiscale sul sito dell'Agenzia."}
                </p>
              )}
              <div>
                <Button
                  size="sm"
                  variant={data.refundReceivedAt ? "ghost" : "default"}
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => markRefundReceived(data.year, !data.refundReceivedAt),
                      data.refundReceivedAt ? undefined : "Che bello: segnato",
                    )
                  }
                >
                  {data.refundReceivedAt ? "Non è ancora arrivato" : "È arrivato"}
                </Button>
              </div>
            </>
          )}
          {data.result! < 0 && (
            <p>
              {data.payer === "agency"
                ? "Senza datore di lavoro lo paghi tu con il modello F24, anche dal sito dell'Agenzia con addebito sul conto, nei termini del modello Redditi: di solito entro il 30 giugno, o il 30 luglio con lo 0,40% in più. Se l'hai inviato più tardi, chiedi a un CAF come metterti in regola."
                : `Te lo trattengono ${timing}. Se la busta paga non basta, il resto slitta ai mesi dopo con un piccolo interesse.`}
            </p>
          )}
          {data.secondAdvance !== null && data.secondAdvance > 0 && (
            <p>
              A novembre ti tratterranno anche il secondo acconto, {money(data.secondAdvance)}. Se
              pensi di guadagnare meno quest&apos;anno, puoi chiedere per iscritto entro il{" "}
              {longDay(data.rules.calendar.advanceNoticeBy)} di trattenerne meno.
            </p>
          )}
        </div>
      )}

      {data.sentAt && data.channel === "CAF" && <CafCheck data={data} />}

      {data.sentAt && (
        <div className="grid gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Wrench className="size-4" aria-hidden /> Hai sbagliato o dimenticato qualcosa?
          </p>
          <ul className="grid gap-1.5 text-sm">
            {corrections.map((c) => (
              <li key={c.kind} className="rounded-xl border p-3">
                {c.kind === "annul" && (
                  <>
                    <span className="font-medium">
                      Annulla e rimanda, entro il {longDay(c.by)}.
                    </span>{" "}
                    <span className="text-muted-foreground">
                      Se l&apos;hai inviato da solo puoi annullarlo una volta sul sito
                      dell&apos;Agenzia e mandarne uno nuovo.
                    </span>
                  </>
                )}
                {c.kind === "integrative" && (
                  <>
                    <span className="font-medium">730 integrativo, entro il {longDay(c.by)}.</span>{" "}
                    <span className="text-muted-foreground">
                      Con un CAF o un professionista, se la correzione è a tuo favore (una spesa
                      dimenticata) o non cambia le tasse.
                    </span>
                  </>
                )}
                {c.kind === "redditi" && (
                  <>
                    <span className="font-medium">Modello Redditi correttivo o integrativo.</span>{" "}
                    <span className="text-muted-foreground">
                      Dopo, o se l&apos;errore è a tuo sfavore: con un CAF o un professionista.
                      Prima lo sistemi, più bassa è la sanzione.
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 rounded-xl border p-3 text-sm">
        <Archive className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium">
            Conserva il 730 e le ricevute del {data.year} fino al 31 dicembre {keep.slice(0, 4)}.
          </span>{" "}
          <span className="text-muted-foreground">
            È il tempo che l&apos;Agenzia ha per controllarli. Le carte delle spese del {throwAway}{" "}
            e prima puoi buttarle.
          </span>
        </p>
      </div>
    </TaxSection>
  );
}

/** "Controlla il CAF": the 730-3 totals against what Orbitly saw, in the browser only. */
function CafCheck({ data }: { data: My730 }) {
  const money = useMoney();
  const [typed, setTyped] = useState<Partial<Record<DeductionType, string>>>({});
  const seen = data.summary.byType.map((t) => t.type);
  const rows = DEDUCTION_TYPES.filter((t) => seen.includes(t)).map((t) => {
    const own = data.summary.byType.find((b) => b.type === t)!.eligible;
    const raw = (typed[t] ?? "").trim();
    const theirs = raw ? Number(parseAmount(raw) ?? 0) : null;
    return { type: t, own, theirs };
  });
  const short = rows.filter((r) => r.theirs !== null && r.theirs < r.own - 1);
  if (!rows.length) return null;

  return (
    <div className="grid gap-2 rounded-xl border p-4">
      <p className="text-sm font-medium">Controlla il lavoro del CAF</p>
      <p className="text-muted-foreground text-xs">
        Scrivi le spese che il CAF ha messo nel quadro E: le confronto con le mie, qui nel browser.
        Non le salvo.
      </p>
      <ul className="divide-y text-sm">
        {rows.map((r) => (
          <li key={r.type} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
            <span className="min-w-0 flex-1">
              {RULES[r.type].label}
              <span className="text-muted-foreground block text-xs">
                Io ne ho viste {money(r.own)}
              </span>
            </span>
            <Input
              inputMode="decimal"
              placeholder="Nel 730"
              className="w-28"
              value={typed[r.type] ?? ""}
              onChange={(e) => setTyped((t) => ({ ...t, [r.type]: e.target.value }))}
              aria-label={`${RULES[r.type].label}: importo nel 730 del CAF`}
            />
          </li>
        ))}
      </ul>
      {short.length > 0 ? (
        <p className={cn("rounded-lg border p-3 text-sm", TONE_BOX.warn)}>
          Nel 730 ci sono meno spese di quelle che ho visto per{" "}
          {short.map((r) => RULES[r.type].label.toLowerCase()).join(", ")}. Chiedi al CAF perché: se
          era una dimenticanza, c&apos;è il 730 integrativo entro il{" "}
          {longDay(data.rules.calendar.integrativeBy)}.
        </p>
      ) : (
        rows.some((r) => r.theirs !== null) && (
          <p className={cn("rounded-lg border p-3 text-sm", TONE_BOX.good)}>
            Per quello che ho visto io, il CAF ha messo tutto.
          </p>
        )
      )}
    </div>
  );
}
