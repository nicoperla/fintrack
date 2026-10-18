"use client";

import Link from "next/link";
import { useTransition, type ReactNode } from "react";
import { Lock, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/* Building blocks shared by the "Il mio 730" sections. */

export function useAction() {
  const [pending, start] = useTransition();
  const run = (action: () => Promise<ActionResult>, success?: string, after?: () => void) =>
    start(async () => {
      const res = await action().catch((): ActionResult => ({ ok: false }));
      if (res.ok) {
        if (success) toast.success(success);
        after?.();
      } else toast.error(res.error ?? "Operazione non riuscita. Riprova.");
    });
  return { pending, run };
}

export function TaxSection({
  id,
  icon: Icon,
  title,
  subtitle,
  aside,
  children,
  className,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "bg-card grid scroll-mt-20 grid-cols-1 gap-4 rounded-2xl border p-5",
        className,
      )}
      aria-labelledby={`${id}-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="flex items-center gap-2 font-medium">
            <Icon className="size-4 shrink-0" aria-hidden /> {title}
          </h2>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Free plan: the numbers are visible, the details are behind Pro. */
export function ProLock({ what }: { what: string }) {
  return (
    <Link
      href="/settings#abbonamento"
      className="bg-muted/50 hover:bg-muted flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm transition-colors"
    >
      <span className="bg-background flex size-8 shrink-0 items-center justify-center rounded-full border">
        <Lock className="size-4" aria-hidden />
      </span>
      <span>
        <span className="font-medium">Con Pro {what}.</span>{" "}
        <span className="text-muted-foreground">Sbloccalo dalle impostazioni.</span>
      </span>
    </Link>
  );
}

export type Tone = "warn" | "good" | "info" | "bad";

export const TONE_BOX: Record<Tone, string> = {
  warn: "border-amber-500/40 bg-amber-500/5",
  good: "border-emerald-500/40 bg-emerald-500/5",
  info: "border-sky-500/30 bg-sky-500/5",
  bad: "border-rose-500/40 bg-rose-500/5",
};

export const TONE_TEXT: Record<Tone, string> = {
  warn: "text-amber-700 dark:text-amber-400",
  good: "text-emerald-700 dark:text-emerald-400",
  info: "text-sky-700 dark:text-sky-400",
  bad: "text-rose-700 dark:text-rose-400",
};

/** A choice drawn as a card (radio or checkbox), for the questions of "Chi sei". */
export function ChoiceCard({
  type,
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors",
        checked ? "border-violet-500/60 bg-violet-500/5" : "hover:bg-muted/50",
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-violet-600"
      />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
      </span>
    </label>
  );
}

/** − 0 + for small counts (children, parents). */
export function Stepper({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        className="hover:bg-muted size-8 rounded-lg border text-lg leading-none disabled:opacity-40"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label={`${label}: uno in meno`}
      >
        −
      </button>
      <span className="w-6 text-center font-medium tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="hover:bg-muted size-8 rounded-lg border text-lg leading-none disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`${label}: uno in più`}
      >
        +
      </button>
    </div>
  );
}
