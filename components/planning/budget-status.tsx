import { CircleAlert, CircleCheck, OctagonAlert } from "lucide-react";
import type { BudgetStatus } from "@/lib/finance/planning";

const STATUS = {
  ok: { label: "In linea", icon: CircleCheck, className: "text-muted-foreground" },
  warning: { label: "Vicino al limite", icon: CircleAlert, className: "text-(--warn-text)" },
  over: { label: "Superato", icon: OctagonAlert, className: "text-(--delta-bad)" },
} as const;

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const { label, icon: Icon, className } = STATUS[status];
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${className}`}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
