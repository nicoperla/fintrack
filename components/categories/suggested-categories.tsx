"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addSuggestedCategories } from "@/app/(dashboard)/categories/actions";
import { CategoryIcon } from "@/lib/category-style";
import { cn } from "@/lib/utils";

export type SuggestionDTO = {
  name: string;
  icon: string;
  color: string;
  missingParent: boolean;
  children: string[];
};

export function SuggestedCategories({ suggestions }: { suggestions: SuggestionDTO[] }) {
  const [selected, setSelected] = useState<string[]>(suggestions.map((s) => s.name));
  const [pending, setPending] = useState(false);
  if (suggestions.length === 0) return null;

  async function add() {
    setPending(true);
    const res = await addSuggestedCategories(selected).catch(() => null);
    setPending(false);
    if (res?.ok) toast.success("Categorie aggiunte");
    else toast.error("Non sono riuscito ad aggiungerle. Riprova.");
  }

  return (
    <section
      className="bg-card grid gap-4 rounded-2xl border p-5"
      aria-labelledby="suggested-title"
    >
      <div>
        <h2 id="suggested-title" className="font-medium">
          Categorie suggerite
        </h2>
        <p className="text-muted-foreground text-sm">
          Nuove categorie e sottocategorie che non hai ancora. Tocca per togliere quelle che non ti
          servono.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((s) => {
          const on = selected.includes(s.name);
          return (
            <li key={s.name}>
              <label
                className={cn(
                  "has-focus-visible:ring-ring/50 flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition-colors has-focus-visible:ring-3",
                  on ? "bg-muted/60 border-foreground/20" : "text-muted-foreground opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() =>
                    setSelected((list) =>
                      on ? list.filter((n) => n !== s.name) : [...list, s.name],
                    )
                  }
                />
                <CategoryIcon name={s.icon} color={on ? s.color : null} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {s.name}
                    {!s.missingParent && (
                      <span className="text-muted-foreground font-normal"> · già presente</span>
                    )}
                  </span>
                  {s.children.length > 0 && (
                    <span className="text-muted-foreground block text-xs">
                      {s.missingParent ? "" : "+ "}
                      {s.children.join(", ")}
                    </span>
                  )}
                </span>
                {on && <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
              </label>
            </li>
          );
        })}
      </ul>
      <Button className="justify-self-start" onClick={add} disabled={pending || !selected.length}>
        <Plus data-icon="inline-start" />
        {pending
          ? "Aggiunta…"
          : selected.length === 1
            ? "Aggiungi 1 gruppo"
            : `Aggiungi ${selected.length} gruppi`}
      </Button>
    </section>
  );
}
