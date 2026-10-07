"use client";

import { useState, type FormEvent } from "react";
import { NotebookPen, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormMessage, TextareaField } from "@/components/forms/form-field";
import { saveFamilyNotes } from "@/app/(dashboard)/fascicolo/actions";
import {
  NOTE_MAX_LENGTH,
  NOTE_SECTIONS,
  secretWarnings,
  type FamilyNotes,
} from "@/lib/family-file";
import type { ActionResult } from "@/lib/action-result";

export function FamilyNotesForm({ notes }: { notes: FamilyNotes }) {
  const [values, setValues] = useState(notes);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = NOTE_SECTIONS.some((s) => values[s.key] !== notes[s.key]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await saveFamilyNotes(values).catch((): ActionResult => ({
      ok: false,
      error: "Salvataggio non riuscito. Riprova.",
    }));
    setPending(false);
    setResult(res.ok ? null : res);
    if (res.ok) toast.success("Note salvate nel fascicolo");
  }

  return (
    <section
      aria-labelledby="note-title"
      className="bg-card grid grid-cols-1 gap-4 rounded-2xl border p-5"
    >
      <div>
        <h2 id="note-title" className="flex items-center gap-2 font-medium">
          <NotebookPen className="size-4" aria-hidden /> Quello che sai solo tu
        </h2>
        <p className="text-muted-foreground text-sm">
          Conti, debiti e abbonamenti li prendo dai tuoi dati. Qui scrivi il resto: dove sono le
          carte, chi chiamare, cosa fare. Mai password o PIN.
        </p>
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        {NOTE_SECTIONS.map((section) => {
          const warnings = secretWarnings(values[section.key]);
          return (
            <div key={section.key} className="grid grid-cols-1 gap-2">
              <TextareaField
                label={section.title}
                name={section.key}
                value={values[section.key]}
                onChange={(e) => setValues((v) => ({ ...v, [section.key]: e.target.value }))}
                rows={3}
                maxLength={NOTE_MAX_LENGTH}
                hint={section.hint}
                errors={result?.fieldErrors?.[section.key]}
              />
              {warnings.map((w) => (
                <p
                  key={w}
                  role="alert"
                  className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-(--warn-text)"
                >
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {w}
                </p>
              ))}
            </div>
          );
        })}
        <div>
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? "Salvataggio…" : "Salva le note"}
          </Button>
        </div>
      </form>
    </section>
  );
}
