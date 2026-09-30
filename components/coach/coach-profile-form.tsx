"use client";

import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/forms/form-field";
import { SliderField } from "@/components/planning/slider-field";
import { CategoryIcon } from "@/lib/category-style";
import {
  COACH_METHODS,
  COACH_PRIORITIES,
  COACH_TONES,
  type CoachMethod,
  type CoachPriority,
  type CoachProfile,
  type CoachTone,
} from "@/lib/finance/coach-profile";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { saveCoachProfile } from "@/app/(dashboard)/coach/actions";

type Category = { id: string; name: string; icon: string | null; color: string | null };

const chip = (active: boolean) =>
  cn(
    "focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "hover:bg-muted text-foreground bg-background",
  );

/** How the user wants to manage money: the coach's frame of reference. */
export function CoachProfileForm({
  profile,
  categories,
  onSaved,
}: {
  profile: CoachProfile;
  categories: Category[];
  onSaved?: () => void;
}) {
  const [method, setMethod] = useState<CoachMethod>(profile.method);
  const [savingsTarget, setSavingsTarget] = useState(profile.savingsTarget);
  const [targetTouched, setTargetTouched] = useState(false);
  const [emergencyMonths, setEmergencyMonths] = useState(profile.emergencyMonths);
  const [priorities, setPriorities] = useState<CoachPriority[]>(profile.priorities);
  const [protectedIds, setProtectedIds] = useState<string[]>(profile.protectedCategoryIds);
  const [tone, setTone] = useState<CoachTone>(profile.tone);
  const [note, setNote] = useState(profile.note);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  function pickMethod(next: CoachMethod) {
    setMethod(next);
    // Each method comes with its own sensible target, until the user sets one.
    if (!targetTouched) setSavingsTarget(COACH_METHODS[next].savingsTarget);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const res = await saveCoachProfile({
      method,
      savingsTarget,
      emergencyMonths,
      priorities,
      protectedCategoryIds: protectedIds,
      tone,
      note,
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setPending(false);
    setResult(res);
    if (res.ok) {
      toast.success("Ricevuto: da ora ti consiglio a modo tuo");
      onSaved?.();
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}

      <fieldset className="grid gap-3">
        <legend className="mb-3 font-medium">Il tuo metodo</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(COACH_METHODS) as CoachMethod[]).map((key) => {
            const active = method === key;
            return (
              <label
                key={key}
                className={cn(
                  "has-focus-visible:ring-ring/50 relative flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-3",
                  active ? "border-primary bg-primary/5" : "hover:bg-muted/60",
                )}
              >
                <input
                  type="radio"
                  name="method"
                  value={key}
                  checked={active}
                  onChange={() => pickMethod(key)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    active && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {active && <Check className="size-3" />}
                </span>
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">{COACH_METHODS[key].label}</span>
                  <span className="text-muted-foreground text-xs">
                    {COACH_METHODS[key].summary}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <SliderField
          label="Quanto vuoi mettere da parte"
          value={savingsTarget}
          onChange={(v) => {
            setTargetTouched(true);
            setSavingsTarget(v);
          }}
          min={0}
          max={60}
          step={1}
          format={(v) => `${v}% delle entrate`}
        />
        <SliderField
          label="Cuscinetto per gli imprevisti"
          value={emergencyMonths}
          onChange={setEmergencyMonths}
          min={1}
          max={12}
          step={1}
          format={(v) => (v === 1 ? "1 mese di spese" : `${v} mesi di spese`)}
        />
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-3 font-medium">Cosa conta di più per te</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(COACH_PRIORITIES) as CoachPriority[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={priorities.includes(key)}
              onClick={() => setPriorities(toggle(priorities, key))}
              className={chip(priorities.includes(key))}
            >
              {priorities.includes(key) && <Check className="size-3.5" aria-hidden />}
              {COACH_PRIORITIES[key]}
            </button>
          ))}
        </div>
      </fieldset>

      {categories.length > 0 && (
        <fieldset className="grid gap-3">
          <legend className="font-medium">A cosa non vuoi rinunciare</legend>
          <p className="text-muted-foreground -mt-1 mb-1 text-sm">
            Non ti proporrò mai di tagliare queste categorie.
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = protectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setProtectedIds(toggle(protectedIds, c.id))}
                  className={cn(chip(active), "py-1 pl-1")}
                >
                  <CategoryIcon name={c.icon} color={active ? "#ffffff" : c.color} size="sm" />
                  {c.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset className="grid gap-3">
        <legend className="mb-3 font-medium">Come vuoi che ti parli</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(COACH_TONES) as CoachTone[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={tone === key}
              onClick={() => setTone(key)}
              className={cn(
                "focus-visible:ring-ring/50 grid gap-0.5 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3",
                tone === key ? "border-primary bg-primary/5" : "hover:bg-muted/60",
              )}
            >
              <span className="text-sm font-medium">{COACH_TONES[key].label}</span>
              <span className="text-muted-foreground text-xs">{COACH_TONES[key].summary}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="coach-note">In parole tue: cosa vuoi dai tuoi soldi?</Label>
        <Textarea
          id="coach-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Es. «Voglio smettere di arrivare a fine mese col fiato corto e fare un viaggio all'anno»"
          aria-describedby="coach-note-hint"
        />
        <p id="coach-note-hint" className="text-muted-foreground text-xs">
          Lo legge il coach AI quando gli fai una domanda. {note.length}/500
        </p>
        {result?.fieldErrors?.note && (
          <p className="text-destructive text-sm">{result.fieldErrors.note[0]}</p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Salvataggio…" : "Salva il mio stile"}
      </Button>
    </form>
  );
}
