"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Check, CalendarClock, ChevronRight, FileText, MapPin, Route, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaxSection, TONE_BOX, TONE_TEXT, useAction } from "@/components/tax/ui";
import { JOURNEY_ICONS, fullDay, onDay, relativeDays } from "@/components/journeys/shared";
import { setStepDone, startJourney, stopJourney } from "@/app/(dashboard)/percorsi/actions";
import { JOURNEYS_CHECKED_AT } from "@/lib/journeys/catalog";
import type { StepProgress } from "@/lib/journeys/progress";
import type { ActionResult } from "@/lib/action-result";
import type { JourneyData } from "@/lib/data/journeys";
import { cn } from "@/lib/utils";

/** One journey: the day of the event, then each step with its date, done or not. */
export function JourneyView({ data }: { data: JourneyData }) {
  const { journey, progress, eventDate } = data;
  const Icon = JOURNEY_ICONS[journey.key];
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(!eventDate);
  const { pending, run } = useAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const res = await startJourney({
      key: journey.key,
      eventDate: String(form.get("eventDate") ?? ""),
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setSaving(false);
    setError(res.fieldErrors?.eventDate?.[0] ?? res.error ?? null);
    if (res.ok) {
      toast.success(eventDate ? "Date aggiornate" : "Percorso iniziato: ecco i passi");
      setChanging(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <TaxSection
        id="evento"
        icon={Icon}
        title={journey.title}
        subtitle={journey.intro}
        aside={
          eventDate && !changing ? (
            <Button variant="outline" size="sm" onClick={() => setChanging(true)}>
              Cambia la data
            </Button>
          ) : null
        }
      >
        {changing ? (
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">{journey.eventLabel}</span>
              <Input
                type="date"
                name="eventDate"
                defaultValue={eventDate ?? data.today}
                aria-invalid={error ? true : undefined}
              />
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvo…" : eventDate ? "Aggiorna" : "Inizia il percorso"}
            </Button>
            {error && <p className="text-destructive w-full text-sm">{error}</p>}
            <p className="text-muted-foreground w-full text-xs">
              Dalla data calcolo le scadenze di ogni passo. Va bene anche una data futura, se il
              momento deve ancora arrivare.
            </p>
          </form>
        ) : (
          progress && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" aria-hidden /> {journey.eventLabel}:{" "}
                <strong>{fullDay(eventDate!)}</strong>
              </span>
              <span className="text-muted-foreground">
                {progress.done} di {progress.total} fatti
                {progress.late > 0 && ` · ${progress.late} in ritardo`}
              </span>
            </div>
          )
        )}
      </TaxSection>

      {progress ? (
        <ol className="grid gap-3">
          {progress.steps.map((step, i) => (
            <StepCard key={step.key} journeyKey={journey.key} step={step} index={i} />
          ))}
        </ol>
      ) : (
        <ol className="grid gap-3">
          {journey.steps.map((step, i) => (
            <li key={step.key} className="bg-card rounded-2xl border p-4 text-sm opacity-80">
              <p className="font-medium">
                {i + 1}. {step.title}
              </p>
              <p className="text-muted-foreground mt-1">{step.text}</p>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-xs">
          Regole e scadenze di solito valide, verificate a {JOURNEYS_CHECKED_AT}: l&apos;ultima
          parola è dell&apos;ufficio indicato in ogni passo. Orbitly ti guida, ma le domande le fai
          tu.
        </p>
        {eventDate && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => stopJourney(journey.key), "Percorso chiuso")}
          >
            <Trash2 /> Chiudi il percorso
          </Button>
        )}
      </div>
    </div>
  );
}

function StepCard({
  journeyKey,
  step,
  index,
}: {
  journeyKey: string;
  step: StepProgress;
  index: number;
}) {
  const { pending, run } = useAction();
  const done = step.state === "done";
  const tone = step.state === "late" ? "bad" : step.state === "soon" ? "warn" : null;

  return (
    <li className={cn("bg-card flex gap-3 rounded-2xl border p-4 text-sm", done && "opacity-70")}>
      <button
        type="button"
        disabled={pending}
        aria-pressed={done}
        aria-label={`${step.title}: ${done ? "fatto" : "da fare"}`}
        onClick={() => run(() => setStepDone(journeyKey, step.key, !done))}
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
          done ? "border-emerald-500 bg-emerald-500 text-white" : "hover:border-foreground/40",
        )}
      >
        {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
      </button>
      <div className="grid min-w-0 flex-1 gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className={cn("font-medium", done && "line-through decoration-emerald-500/60")}>
            {step.title}
          </p>
          {step.due && !done && (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs whitespace-nowrap",
                tone ? cn(TONE_BOX[tone], TONE_TEXT[tone]) : "text-muted-foreground",
              )}
            >
              {step.legal ? "entro" : "meglio entro"} {onDay(step.due)} · {relativeDays(step.days!)}
            </span>
          )}
        </div>
        <p className="text-muted-foreground">{step.text}</p>
        {step.documents && step.documents.length > 0 && (
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {step.documents.join(" · ")}
          </p>
        )}
        {step.where && (
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {step.where}
          </p>
        )}
        {step.app && (
          <Link
            href={step.app.href}
            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            <Route className="size-3.5" aria-hidden /> {step.app.label}
            <ChevronRight className="size-3" aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}
