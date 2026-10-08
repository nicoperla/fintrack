"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { addDecision } from "@/app/(dashboard)/caffe/actions";
import { DECISION_MAX, type Suggestion } from "@/lib/finance/money-talk";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const failed = (): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." });

/**
 * Step 4: pick what to decide about (or something else), then write the decision with a name
 * next to it. The suggestion's topic goes in the log, never its amounts.
 */
export function DecisionForm({
  month,
  suggestions,
  members,
  today,
}: {
  month: string;
  suggestions: {
    suggestion: Suggestion;
    text: string;
    link: { href: string; label: string } | null;
  }[];
  members: { id: string; name: string }[];
  today: string;
}) {
  const [topic, setTopic] = useState<number | null>(suggestions.length === 1 ? 0 : null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = result?.fieldErrors;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const res = await addDecision({
      month,
      topic: topic !== null ? suggestions[topic].suggestion.topic : "",
      text: String(form.get("text") ?? ""),
      ownerId: String(form.get("ownerId") ?? ""),
      dueOn: String(form.get("dueOn") ?? ""),
    }).catch(failed);
    setPending(false);
    setResult(res.ok ? null : res);
    if (res.ok) {
      toast.success("Decisione segnata");
      formRef.current?.reset();
      setTopic(null);
    }
  }

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium text-white/85">Di cosa decidere</legend>
        {suggestions.map((s, i) => (
          <div
            key={s.suggestion.topic}
            className={cn(
              "rounded-2xl border-2 transition-colors",
              topic === i ? "border-white bg-white/20" : "border-white/25 bg-white/10",
            )}
          >
            <label className="flex cursor-pointer items-start gap-3 p-3">
              <input
                type="radio"
                name="talk-topic"
                checked={topic === i}
                onChange={() => setTopic(i)}
                className="mt-1 size-4 accent-white"
              />
              <span className="text-base leading-snug">{s.text}</span>
            </label>
            {s.link && (
              <Link
                href={s.link.href}
                className="-mt-1 mb-3 ml-10 inline-flex items-center gap-1 text-xs font-medium text-white/80 underline-offset-2 hover:underline"
              >
                {s.link.label} <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            )}
          </div>
        ))}
        <label
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition-colors",
            topic === null ? "border-white bg-white/20" : "border-white/25 bg-white/10",
          )}
        >
          <input
            type="radio"
            name="talk-topic"
            checked={topic === null}
            onChange={() => setTopic(null)}
            className="size-4 accent-white"
          />
          <span className="text-base">Altro: ne avete in mente un&apos;altra</span>
        </label>
      </fieldset>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        className="bg-background text-foreground grid gap-4 rounded-2xl p-4 shadow-lg"
      >
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <FormField
          label="Cosa decidete"
          name="text"
          maxLength={DECISION_MAX}
          placeholder="Es. spesa online una volta a settimana"
          errors={errors?.text}
          autoComplete="off"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Chi se ne occupa"
            name="ownerId"
            defaultValue=""
            errors={errors?.ownerId}
          >
            <NativeSelectOption value="">Insieme</NativeSelectOption>
            {members.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.name}
              </NativeSelectOption>
            ))}
          </SelectField>
          <FormField
            label="Entro quando (facoltativo)"
            name="dueOn"
            type="date"
            min={today}
            errors={errors?.dueOn}
          />
        </div>
        <Button type="submit" disabled={pending} className="justify-self-start">
          {pending ? "Salvataggio…" : "Segna la decisione"}
        </Button>
      </form>
    </div>
  );
}
