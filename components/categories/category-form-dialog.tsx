"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { saveCategory } from "@/app/(dashboard)/categories/actions";
import {
  CATEGORY_COLORS,
  CATEGORY_ICON_NAMES,
  CATEGORY_ICONS,
  CategoryIcon,
} from "@/lib/category-style";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type CategoryKind = "INCOME" | "EXPENSE";

export type EditableCategory = {
  id: string;
  name: string;
  type: CategoryKind;
  icon: string | null;
  color: string | null;
  parentId: string | null;
};

type ParentOption = { id: string; name: string; type: CategoryKind };

export function CategoryFormDialog({
  category,
  defaults,
  parents,
  trigger,
}: {
  category?: EditableCategory;
  defaults?: { type?: CategoryKind; parentId?: string; color?: string | null };
  parents: ParentOption[];
  trigger: React.ReactElement;
}) {
  const initial = {
    type: category?.type ?? defaults?.type ?? "EXPENSE",
    parentId: category?.parentId ?? defaults?.parentId ?? "",
    icon: category?.icon ?? "receipt",
    color: category?.color ?? defaults?.color ?? CATEGORY_COLORS[0],
  };

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CategoryKind>(initial.type);
  const [parentId, setParentId] = useState(initial.parentId);
  const [icon, setIcon] = useState(initial.icon);
  const [color, setColor] = useState(initial.color);
  const [name, setName] = useState(category?.name ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);

  function handleOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) {
      setType(initial.type);
      setParentId(initial.parentId);
      setIcon(initial.icon);
      setColor(initial.color);
      setName(category?.name ?? "");
      setResult(null);
    }
  }

  function changeType(next: CategoryKind) {
    setType(next);
    setParentId("");
  }

  function changeParent(next: string) {
    setParentId(next);
    const parent = parents.find((p) => p.id === next);
    if (parent) setType(parent.type);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await saveCategory(category?.id ?? null, {
      name,
      type,
      parentId,
      icon,
      color,
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success(category ? "Categoria aggiornata" : "Categoria creata");
    setOpen(false);
  }

  const parentOptions = parents.filter((p) => p.type === type && p.id !== category?.id);
  const errors = result?.fieldErrors;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Modifica categoria" : "Nuova categoria"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}

          <div className="flex items-center gap-3">
            <CategoryIcon name={icon} color={color} />
            <div className="flex-1">
              <FormField
                label="Nome"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Es. Spesa"
                required
                autoFocus
                errors={errors?.name}
              />
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Tipo</legend>
            <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
              {(
                [
                  ["EXPENSE", "Uscita"],
                  ["INCOME", "Entrata"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={cn(
                    "has-focus-visible:ring-ring/50 cursor-pointer rounded-md py-1.5 text-center text-sm transition-colors has-focus-visible:ring-3",
                    type === value
                      ? "bg-background font-medium shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    checked={type === value}
                    onChange={() => changeType(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
            {errors?.type && <p className="text-destructive text-sm">{errors.type[0]}</p>}
          </fieldset>

          <SelectField
            label="Categoria principale"
            name="parentId"
            value={parentId}
            onChange={(e) => changeParent(e.target.value)}
            hint="Lascia vuoto per creare una categoria principale."
            errors={errors?.parentId}
          >
            <NativeSelectOption value="">Nessuna (categoria principale)</NativeSelectOption>
            {parentOptions.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name}
              </NativeSelectOption>
            ))}
          </SelectField>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Icona</legend>
            <div className="grid grid-cols-8 gap-1.5">
              {CATEGORY_ICON_NAMES.map((iconName) => {
                const Icon = CATEGORY_ICONS[iconName];
                const selected = icon === iconName;
                return (
                  <label
                    key={iconName}
                    title={iconName}
                    className={cn(
                      "hover:bg-muted has-focus-visible:ring-ring/50 flex aspect-square cursor-pointer items-center justify-center rounded-md border border-transparent transition-colors has-focus-visible:ring-3",
                      selected && "border-foreground/20 bg-muted",
                    )}
                    style={selected ? { color } : undefined}
                  >
                    <input
                      type="radio"
                      name="icon"
                      value={iconName}
                      checked={selected}
                      onChange={() => setIcon(iconName)}
                      className="sr-only"
                    />
                    <Icon className="size-4" aria-hidden />
                    <span className="sr-only">{iconName}</span>
                  </label>
                );
              })}
            </div>
            {errors?.icon && <p className="text-destructive mt-2 text-sm">{errors.icon[0]}</p>}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Colore</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <label
                  key={c}
                  className={cn(
                    "has-focus-visible:ring-ring/50 flex size-7 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-(--popover) has-focus-visible:ring-3",
                    color === c && "ring-foreground/60 ring-2",
                  )}
                  style={{ backgroundColor: c }}
                >
                  <input
                    type="radio"
                    name="color"
                    value={c}
                    checked={color === c}
                    onChange={() => setColor(c)}
                    className="sr-only"
                  />
                  <span className="sr-only">{c}</span>
                </label>
              ))}
            </div>
            {errors?.color && <p className="text-destructive mt-2 text-sm">{errors.color[0]}</p>}
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvataggio…" : category ? "Salva modifiche" : "Crea categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
