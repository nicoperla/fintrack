"use client";

import { useState, useTransition } from "react";
import { Check, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { onDate } from "@/components/true-salary/format";
import { deleteDecision, setDecisionDone } from "@/app/(dashboard)/caffe/actions";
import type { MoneyTalkPage } from "@/lib/data/money-talk";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

export type Decision = MoneyTalkPage["decisions"][number];

const failed = (): ActionResult => ({ ok: false, error: "Operazione non riuscita. Riprova." });

/**
 * One decision with its tick: on the talk's coloured panel (`panel`) or in the log on the page.
 * The tick saves right away, so a decision can be closed during the talk or any day after.
 */
export function DecisionItem({
  decision: d,
  today,
  tone,
  showMonth = false,
  canDelete = false,
}: {
  decision: Decision;
  today: string;
  tone: "panel" | "page";
  showMonth?: boolean;
  canDelete?: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const late = !d.done && d.dueOn !== null && d.dueOn < today;
  const panel = tone === "panel";

  const toggle = () =>
    start(async () => {
      const res = await setDecisionDone(d.id, !d.done).catch(failed);
      if (!res.ok) toast.error(res.error ?? "Operazione non riuscita. Riprova.");
    });

  return (
    <li className="flex items-start gap-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={d.done}
        aria-label={d.done ? `Riapri: ${d.text}` : `Segna come fatta: ${d.text}`}
        disabled={pending}
        onClick={toggle}
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-60",
          panel
            ? d.done
              ? "border-white bg-white text-violet-700"
              : "border-white/70 hover:bg-white/15"
            : d.done
              ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
              : "border-muted-foreground/50 hover:border-foreground",
        )}
      >
        {d.done && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", d.done && "line-through opacity-70")}>{d.text}</p>
        <p
          className={cn(
            "flex flex-wrap gap-x-2 text-xs",
            panel ? "text-white/75" : "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-1">
            <UsersRound className="size-3" aria-hidden />
            {d.owner ? d.owner.name : "Insieme"}
          </span>
          {d.dueOn && !d.done && (
            <span
              className={cn(late && (panel ? "font-semibold text-white" : "text-(--warn-text)"))}
            >
              {late ? `doveva essere fatta entro ${onDate(d.dueOn)}` : `entro ${onDate(d.dueOn)}`}
            </span>
          )}
          {d.topic && <span>{d.topic}</span>}
          {showMonth && <span>caffè di {d.monthName}</span>}
        </p>
      </div>
      {canDelete && (
        <>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            aria-label={`Elimina: ${d.text}`}
            className="text-muted-foreground hover:text-destructive rounded-md p-1"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
          <ConfirmDeleteDialog
            open={confirm}
            onOpenChange={setConfirm}
            title="Eliminare la decisione?"
            description={`«${d.text}» sparisce dal registro dello spazio, per tutti. Se l'avete fatta, segnatela come fatta invece.`}
            successMessage="Decisione eliminata"
            onConfirm={() => deleteDecision(d.id)}
          />
        </>
      )}
    </li>
  );
}
