"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { ColorPicker, IconPicker } from "@/components/forms/icon-color-picker";
import { contributeToGoal, saveGoal } from "@/app/(dashboard)/goals/actions";
import { CATEGORY_COLORS, CategoryIcon, type CategoryIconName } from "@/lib/category-style";
import { formatCurrency } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const GOAL_ICONS: CategoryIconName[] = [
  "piggy-bank",
  "plane",
  "home",
  "car",
  "gift",
  "graduation-cap",
  "laptop",
  "smartphone",
  "heart-pulse",
  "baby",
  "dog",
  "shirt",
  "book-open",
  "sparkles",
  "landmark",
  "trending-up",
];

export type EditableGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  icon: string | null;
  color: string | null;
};

const toInput = (n: number) => n.toFixed(2).replace(".", ",").replace(/,00$/, "");

function useDialogAction() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) setResult(null);
  }

  async function run(action: () => Promise<ActionResult>, success: string) {
    setPending(true);
    const res = await action().catch((): ActionResult => ({
      ok: false,
      error: "Operazione non riuscita. Riprova.",
    }));
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return false;
    }
    toast.success(success);
    setOpen(false);
    return true;
  }

  return { open, onOpenChange, result, pending, run };
}

export function GoalFormDialog({
  goal,
  trigger,
}: {
  goal?: EditableGoal;
  trigger: React.ReactElement;
}) {
  const dialog = useDialogAction();
  const [icon, setIcon] = useState(goal?.icon ?? "piggy-bank");
  const [color, setColor] = useState(goal?.color ?? CATEGORY_COLORS[10]);

  function onOpenChange(next: boolean) {
    dialog.onOpenChange(next);
    if (next) {
      setIcon(goal?.icon ?? "piggy-bank");
      setColor(goal?.color ?? CATEGORY_COLORS[10]);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    dialog.run(
      () =>
        saveGoal(goal?.id ?? null, {
          name: form.get("name"),
          targetAmount: form.get("targetAmount"),
          currentAmount: form.get("currentAmount"),
          targetDate: form.get("targetDate"),
          icon,
          color,
        }),
      goal ? "Obiettivo aggiornato" : "Obiettivo creato",
    );
  }

  const errors = dialog.result?.fieldErrors;
  return (
    <Dialog open={dialog.open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{goal ? "Modifica obiettivo" : "Nuovo obiettivo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {dialog.result?.error && <FormMessage tone="error">{dialog.result.error}</FormMessage>}
          <div className="flex items-end gap-3">
            <CategoryIcon name={icon} color={color} />
            <div className="flex-1">
              <FormField
                label="Nome"
                name="name"
                placeholder="Es. Vacanza in Giappone"
                defaultValue={goal?.name}
                autoFocus
                errors={errors?.name}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Obiettivo (€)"
              name="targetAmount"
              inputMode="decimal"
              placeholder="3.000"
              defaultValue={goal ? toInput(goal.targetAmount) : ""}
              errors={errors?.targetAmount}
            />
            <FormField
              label="Già messo da parte (€)"
              name="currentAmount"
              inputMode="decimal"
              placeholder="0"
              defaultValue={goal ? toInput(goal.currentAmount) : ""}
              errors={errors?.currentAmount}
            />
          </div>
          <FormField
            label="Da raggiungere entro (facoltativo)"
            name="targetDate"
            type="date"
            defaultValue={goal?.targetDate ?? ""}
            hint="Con una data ti suggeriamo quanto mettere da parte ogni mese."
            errors={errors?.targetDate}
          />
          <IconPicker
            value={icon}
            color={color}
            onChange={setIcon}
            icons={GOAL_ICONS}
            error={errors?.icon?.[0]}
          />
          <ColorPicker value={color} onChange={setColor} error={errors?.color?.[0]} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={dialog.pending}>
              {dialog.pending ? "Salvataggio…" : goal ? "Salva modifiche" : "Crea obiettivo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContributionDialog({
  goal,
  trigger,
}: {
  goal: EditableGoal;
  trigger: React.ReactElement;
}) {
  const dialog = useDialogAction();
  const [direction, setDirection] = useState<"deposit" | "withdraw">("deposit");

  function onOpenChange(next: boolean) {
    dialog.onOpenChange(next);
    if (next) setDirection("deposit");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    dialog.run(
      () => contributeToGoal(goal.id, { direction, amount: form.get("amount") }),
      direction === "deposit" ? "Versamento registrato" : "Prelievo registrato",
    );
  }

  return (
    <Dialog open={dialog.open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal.name}</DialogTitle>
          <DialogDescription>
            Hai messo da parte {formatCurrency(goal.currentAmount)} su{" "}
            {formatCurrency(goal.targetAmount)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {dialog.result?.error && <FormMessage tone="error">{dialog.result.error}</FormMessage>}
          <div
            role="radiogroup"
            aria-label="Operazione"
            className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1"
          >
            {(
              [
                ["deposit", "Aggiungi"],
                ["withdraw", "Preleva"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "has-focus-visible:ring-ring/50 cursor-pointer rounded-md py-1.5 text-center text-sm transition-colors has-focus-visible:ring-3",
                  direction === value
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                <input
                  type="radio"
                  name="direction"
                  value={value}
                  checked={direction === value}
                  onChange={() => setDirection(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          <FormField
            label="Importo (€)"
            name="amount"
            inputMode="decimal"
            placeholder="100"
            autoFocus
            className="text-lg font-medium"
            errors={dialog.result?.fieldErrors?.amount}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={dialog.pending}>
              {dialog.pending ? "Salvataggio…" : direction === "deposit" ? "Aggiungi" : "Preleva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
