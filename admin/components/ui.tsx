import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const BUTTON = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  secondary: "border border-line bg-raised text-white hover:bg-line/60",
  danger: "bg-red-500/90 text-white hover:bg-red-500",
  ghost: "text-muted hover:bg-raised hover:text-white",
} as const;

export type ButtonVariant = keyof typeof BUTTON;

export function buttonClass(variant: ButtonVariant = "secondary", small = false) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    small ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
    BUTTON[variant],
  );
}

export function Button({
  variant,
  small,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; small?: boolean }) {
  return <button className={cn(buttonClass(variant, small), className)} {...props} />;
}

export function LinkButton({
  variant,
  small,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; small?: boolean }) {
  return <Link className={cn(buttonClass(variant, small), className)} {...props} />;
}

const TONES = {
  neutral: "bg-white/10 text-slate-200",
  green: "bg-emerald-400/15 text-emerald-300",
  amber: "bg-amber-400/15 text-amber-300",
  red: "bg-red-400/15 text-red-300",
  blue: "bg-sky-400/15 text-sky-300",
  violet: "bg-violet-400/15 text-violet-300",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-line bg-panel rounded-2xl border p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-semibold text-white">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "accent" | "warn";
}) {
  return (
    <div className="border-line bg-panel rounded-2xl border p-4">
      <p className="text-muted text-xs font-medium tracking-wide uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "accent" && "text-accent",
          tone === "warn" && "text-amber-300",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
    </div>
  );
}

export function PageTitle({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {text && <p className="text-muted mt-1 text-sm">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export const inputClass =
  "border-line bg-ink h-9 w-full rounded-lg border px-3 text-sm text-white placeholder:text-slate-500 focus:border-accent focus:outline-none";

export function Field({
  label,
  hint,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      <input className={inputClass} {...props} />
      {hint && <span className="text-muted text-xs">{hint}</span>}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted py-6 text-center text-sm">{children}</p>;
}

/** A table that scrolls sideways inside its card instead of widening the page. */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export const th = "text-muted border-line border-b px-3 py-2 text-xs font-medium uppercase";
export const td = "border-line/50 border-b px-3 py-2.5 align-middle";
