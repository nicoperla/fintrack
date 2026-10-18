"use client";

import { useState, type FormEvent } from "react";
import { CalendarDays, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaxSection, TONE_BOX, useAction } from "@/components/tax/ui";
import { markSent, unmarkSent } from "@/app/(dashboard)/730/actions";
import { describeTiming, longDay, sendDeadlines } from "@/lib/tax/calendar";
import type { ActionResult } from "@/lib/action-result";
import type { My730 } from "@/lib/data/my730";
import { cn } from "@/lib/utils";

const SELF_CHECKS = [
  {
    title: "Chi ti paga a luglio",
    text: "Nel frontespizio, il sostituto d'imposta: è il datore di lavoro (o l'ente pensionistico) che farà il rimborso o la trattenuta. Se non c'è nessuno, scrivi l'IBAN.",
  },
  {
    title: "Familiari a carico",
    text: "Codici fiscali, mesi a carico e percentuale (50% o 100%) di coniuge, figli e genitori.",
  },
  {
    title: "L'8, il 5 e il 2 per mille",
    text: "Non costano niente: l'8 per mille va allo Stato o a una confessione religiosa, il 5 per mille a un ente che scegli (ricerca, volontariato, il tuo Comune), il 2 per mille a un partito. Puoi anche non scegliere.",
  },
  {
    title: "La ricevuta",
    text: "Dopo l'invio scarica la ricevuta e il prospetto di liquidazione (730-3): il risultato lo scrivi qui sotto.",
  },
];

const CAF_CHECKS = [
  {
    title: "Prenota presto",
    text: "Maggio e giugno sono pieni: prenotare per tempo vuol dire avere il rimborso prima.",
  },
  {
    title: "Chiedi il prezzo",
    text: "Le tariffe cambiano da CAF a CAF; con l'iscrizione a un sindacato o a un'associazione spesso costa meno.",
  },
  {
    title: "Porta la lista dei documenti",
    text: "Gli originali: il promemoria di Orbitly serve a te per non dimenticare niente, non al CAF.",
  },
  {
    title: "Prima di firmare",
    text: "Fatti mostrare il 730-3 e confrontalo con la mia stima: se manca una spesa, chiedilo subito.",
  },
];

/** Sending the 730 (alone or with a CAF): the checks, the dates that move the refund, "Ho inviato". */
export function SendCard({ data }: { data: My730 }) {
  const { pending, run } = useAction();
  const [channel, setChannel] = useState<"SELF" | "CAF">(
    data.channel ?? (data.decision === "CAF" ? "CAF" : "SELF"),
  );
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const caf = data.decision === "CAF";
  const checks = caf ? CAF_CHECKS : SELF_CHECKS;
  const deadlines = sendDeadlines(data.rules, data.today, data.payer);
  const c = data.rules.calendar;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const res = await markSent(data.year, {
      channel,
      sentAt: String(form.get("sentAt") ?? ""),
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setSaving(false);
    setErrors(res.fieldErrors ?? {});
    if (res.ok) toast.success("Segnato: ora ti dico quando arrivano i soldi");
    else if (res.error) toast.error(res.error);
  }

  return (
    <TaxSection
      id="invio"
      icon={Send}
      title={caf ? "Al CAF" : "L'invio"}
      subtitle={`Da ${longDay(c.sendFrom)} al ${longDay(c.deadline)}: prima invii, prima arriva il rimborso.`}
    >
      {data.sentAt ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm",
            TONE_BOX.good,
          )}
        >
          <p>
            <span className="font-medium">
              Inviato il {longDay(data.sentAt)}
              {data.channel === "CAF" ? " tramite il CAF" : " da solo"}.
            </span>{" "}
            {data.timing && (
              <>Il rimborso o la trattenuta arrivano {describeTiming(data.timing)}.</>
            )}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => unmarkSent(data.year), "Tolto")}
          >
            <Undo2 /> Non l&apos;ho ancora inviato
          </Button>
        </div>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {checks.map((check, i) => (
              <li key={check.title} className="flex gap-3 rounded-xl border p-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-xs font-semibold text-violet-700 dark:text-violet-300">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{check.title}</p>
                  <p className="text-muted-foreground text-xs">{check.text}</p>
                </div>
              </li>
            ))}
          </ul>

          {deadlines.length > 0 && (
            <div className="grid gap-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <CalendarDays className="size-4" aria-hidden /> Quando arriva il rimborso, secondo
                il giorno dell&apos;invio
              </p>
              <ul className="divide-y text-sm">
                {deadlines.map((d) => (
                  <li key={d.sentBy} className="flex justify-between gap-3 py-1.5">
                    <span>Entro il {longDay(d.sentBy)}</span>
                    <span className="text-muted-foreground text-right">
                      {describeTiming(d.timing)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.payer === "agency" && (
            <p className="text-muted-foreground text-sm">
              Senza datore di lavoro o pensione, il rimborso te lo paga l&apos;Agenzia sul conto: di
              solito da dicembre, e comunque entro sei mesi dalla scadenza.
            </p>
          )}

          <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border p-4" noValidate>
            <p className="text-sm font-medium">Fatto? Segnalo qui</p>
            <div className="flex flex-wrap items-end gap-3">
              <div
                className="bg-muted inline-flex rounded-lg p-0.5 text-sm"
                role="group"
                aria-label="Come l'hai inviato"
              >
                {(["SELF", "CAF"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={channel === v}
                    onClick={() => setChannel(v)}
                    className={cn(
                      "rounded-md px-3 py-1",
                      channel === v && "bg-background font-medium shadow-sm",
                    )}
                  >
                    {v === "SELF" ? "Da solo" : "Con il CAF"}
                  </button>
                ))}
              </div>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground text-xs">Il giorno dell&apos;invio</span>
                <Input
                  type="date"
                  name="sentAt"
                  defaultValue={data.today}
                  max={data.today}
                  aria-invalid={errors.sentAt ? true : undefined}
                />
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvo…" : "Ho inviato il 730"}
              </Button>
            </div>
            {errors.sentAt && <p className="text-destructive text-xs">{errors.sentAt[0]}</p>}
          </form>
        </>
      )}
    </TaxSection>
  );
}
