"use client";

import { useState } from "react";
import { Check, ClipboardList, Download, MinusCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { TaxSection, useAction } from "@/components/tax/ui";
import { setDocState } from "@/app/(dashboard)/730/actions";
import {
  DOC_GROUP_LABELS,
  docProgress,
  type DocGroup,
  type DocItem,
  type DocState,
} from "@/lib/tax/documents";
import { cn } from "@/lib/utils";

const GROUPS: DocGroup[] = ["base", "family", "home", "expenses", "income"];

/** The documents to prepare, with ticks; the CAF view adds what only the CAF asks for. */
export function DocumentsCard({
  year,
  items,
  states,
  caf,
  pro,
  answered,
}: {
  year: number;
  items: DocItem[];
  states: Record<string, DocState>;
  /** Going to a CAF (from the decision or the channel). */
  caf: boolean;
  pro: boolean;
  answered: boolean;
}) {
  const [cafView, setCafView] = useState(caf);
  const [local, setLocal] = useState(states);
  const { run } = useAction();
  const shown = items.filter((i) => cafView || !i.cafOnly);
  const progress = docProgress(items, local, cafView);
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  function set(key: string, state: DocState | null) {
    setLocal((prev) => {
      const next = { ...prev };
      if (state) next[key] = state;
      else delete next[key];
      return next;
    });
    run(() => setDocState(year, key, state));
  }

  return (
    <TaxSection
      id="documenti"
      icon={ClipboardList}
      title="I documenti da preparare"
      subtitle={
        answered
          ? "Solo quelli che servono a te. Sono gli originali da conservare: il riepilogo di Orbitly è solo un promemoria."
          : "La lista base: rispondi a «Chi sei» e la faccio su misura."
      }
      aside={
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="bg-muted inline-flex rounded-lg p-0.5 text-xs"
            role="group"
            aria-label="Come lo fai"
          >
            {[
              { v: false, label: "Faccio da solo" },
              { v: true, label: "Vado al CAF" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={cafView === o.v}
                onClick={() => setCafView(o.v)}
                className={cn(
                  "rounded-md px-2 py-1",
                  cafView === o.v && "bg-background font-medium shadow-sm",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {pro && (
            <a
              href={`/api/730/promemoria?anno=${year}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download /> Promemoria PDF
            </a>
          )}
        </div>
      }
    >
      <div className="flex items-center gap-3">
        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-sm tabular-nums">
          {progress.done} di {progress.total} pronti
        </span>
      </div>

      {GROUPS.map((group) => {
        const list = shown.filter((i) => i.group === group);
        if (!list.length) return null;
        return (
          <div key={group} className="grid gap-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {DOC_GROUP_LABELS[group]}
            </p>
            <ul className="divide-y">
              {list.map((item) => {
                const state = local[item.key];
                return (
                  <li key={item.key} className="flex items-start gap-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => set(item.key, state === "have" ? null : "have")}
                      aria-pressed={state === "have"}
                      aria-label={`${item.label}: ${state === "have" ? "pronto" : "da preparare"}`}
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        state === "have"
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "hover:border-foreground/40",
                      )}
                    >
                      {state === "have" && <Check className="size-3.5" aria-hidden />}
                    </button>
                    <div className={cn("min-w-0 flex-1 text-sm", state === "skip" && "opacity-50")}>
                      <p
                        className={cn(
                          "font-medium",
                          state === "have" && "line-through decoration-emerald-500/60",
                        )}
                      >
                        {item.label}
                        {item.cafOnly && (
                          <span className="bg-muted text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-[10px] font-normal tracking-wide uppercase">
                            per il CAF
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">{item.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => set(item.key, state === "skip" ? null : "skip")}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                      aria-pressed={state === "skip"}
                    >
                      <MinusCircle className="size-3.5" aria-hidden />
                      {state === "skip" ? "Mi riguarda" : "Non mi riguarda"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </TaxSection>
  );
}
