import type { ReactNode } from "react";
import {
  AlertTriangle,
  Ban,
  CircleCheck,
  Files,
  Hourglass,
  Info,
  Landmark,
  Pencil,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { ClaimKind, ClaimStatus } from "@prisma/client";
import type { NextStep, StepTone } from "@/lib/finance/claims";
import { cn } from "@/lib/utils";

/* Small pieces shared by the "Riprenditeli" pages and by "Soldi ritrovati". */

export const KIND_ICONS: Record<ClaimKind, LucideIcon> = {
  CANCELLATION: Ban,
  DIRECT_DEBIT_REFUND: Undo2,
  BANK_COMPLAINT: Landmark,
  DUPLICATE_CHARGE: Files,
};

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  DRAFT: "Da inviare",
  SENT: "Inviata",
  WON: "Vinta",
  PARTIAL: "Recuperato in parte",
  LOST: "Respinta",
  DROPPED: "Lasciata perdere",
};

const STATUS_STYLES: Record<ClaimStatus, string> = {
  DRAFT: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  SENT: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  WON: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  PARTIAL: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  LOST: "bg-muted text-muted-foreground",
  DROPPED: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: ClaimStatus; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function KindIcon({ kind, className }: { kind: ClaimKind; className?: string }) {
  const Icon = KIND_ICONS[kind];
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

const TONE_STYLES: Record<StepTone, string> = {
  urgent: "border-amber-500/40 bg-amber-500/10 text-(--warn-text)",
  todo: "border-sky-500/30 bg-sky-500/5",
  waiting: "border-border bg-muted/40",
  done: "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300",
  closed: "border-border bg-muted/40 text-muted-foreground",
};

const TONE_ICONS: Record<StepTone, LucideIcon> = {
  urgent: AlertTriangle,
  todo: Pencil,
  waiting: Hourglass,
  done: CircleCheck,
  closed: Info,
};

/** What to do now, in the colors of its urgency. */
export function StepNote({
  step,
  children,
  className,
}: {
  step: NextStep;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = TONE_ICONS[step.tone];
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-3 text-sm",
        TONE_STYLES[step.tone],
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="grid min-w-0 flex-1 gap-2">
        <p>{step.text}</p>
        {children}
      </div>
    </div>
  );
}

export const CLAIMS_DISCLAIMER =
  "Le lettere sono modelli da completare e controllare prima dell'invio: non sono consulenza legale. FinTrack non invia niente al posto tuo.";
