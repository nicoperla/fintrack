"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CalendarDays, CornerDownLeft, Hourglass, Mic, Pencil, Wallet, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";
import { saveOrQueue } from "@/lib/offline/save";
import { parseQuickEntry, type QuickEntryContext } from "@/lib/quick-entry/parse";
import { CategoryIcon } from "@/lib/category-style";
import {
  useMoney,
  useSpaceInfo,
  useAmountsHidden,
  useWorkTime,
} from "@/components/currency-provider";
import { useDictation } from "@/components/quick-entry/use-dictation";
import { maskAmounts } from "@/components/amount";
import type { AccountOption, CategoryOption, TransactionDTO } from "@/lib/dto";
import { cn } from "@/lib/utils";

// shadcn's Input targets React 19 (ref as a prop); on React 18 it drops refs, so focus by id.
const INPUT_ID = "quick-entry-input";

// The full form is only needed when the user asks to edit: keep it out of the initial bundle.
const TransactionFormDialog = dynamic(
  () =>
    import("@/components/transactions/transaction-form-dialog").then(
      (m) => m.TransactionFormDialog,
    ),
  { ssr: false },
);

const dayMonth = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function relativeDay(date: string, today: string) {
  const diff = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000,
  );
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Ieri";
  if (diff === 2) return "L'altro ieri";
  return dayMonth.format(new Date(`${date}T00:00:00Z`));
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        "bg-muted flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
        muted && "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function QuickEntry({
  context,
  accounts,
  categories,
}: {
  context: QuickEntryContext;
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const money = useMoney();
  const { userId, spaceId } = useSpaceInfo();
  const workTimeOf = useWorkTime();
  const dictation = useDictation((spoken) => setText(spoken));
  useEffect(() => {
    if (dictation.error === "denied") {
      toast.error("Per dettare, consenti al browser di usare il microfono.");
    } else if (dictation.error === "no-speech") {
      toast("Non ho sentito nulla: tocca il microfono e riprova.");
    } else if (dictation.error === "unavailable") {
      toast.error("La dettatura non è disponibile ora: scrivi il movimento.");
    }
  }, [dictation.error]);
  const amountsHidden = useAmountsHidden();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<TransactionDTO | null>(null);

  const parsed = useMemo(
    () => (text.trim() ? parseQuickEntry(text, context) : null),
    [text, context],
  );

  const categoryInfo = useMemo(() => {
    const all = categories.flatMap((c) => [
      c,
      ...c.children.map((ch) => ({ ...ch, parent: c.name })),
    ]);
    return new Map(all.map((c) => [c.id, c]));
  }, [categories]);
  const category = parsed?.categoryId ? categoryInfo.get(parsed.categoryId) : undefined;
  const account = accounts.find((a) => a.id === parsed?.accountId);
  const workTime =
    parsed?.type === "EXPENSE" && parsed.amount
      ? workTimeOf(Number(parsed.amount), account?.currency)
      : null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing = target.closest("input, textarea, select, [contenteditable=true]");
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        document.getElementById(INPUT_ID)?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toDTO(): TransactionDTO | null {
    if (!parsed || !account) return null;
    return {
      id: "",
      type: parsed.type,
      amount: parsed.amount ?? "",
      baseAmount: parsed.amount ?? "",
      transferAmount: null,
      date: parsed.date,
      description: parsed.description,
      notes: null,
      tags: parsed.tags,
      account: { id: account.id, name: account.name, currency: account.currency },
      transferAccount: null,
      author: null,
      category: category
        ? {
            id: category.id,
            name: category.name,
            icon: category.icon,
            color: category.color,
            parentName: null,
          }
        : null,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!parsed) return;
    if (!parsed.amount || !parsed.accountId) {
      openFullForm();
      return;
    }
    setPending(true);
    const sign = parsed.type === "INCOME" ? "+" : "−";
    const label = `${parsed.description} ${sign}${money(parsed.amount, account?.currency)}`;
    const res = await saveOrQueue(
      {
        type: parsed.type,
        amount: parsed.amount,
        date: parsed.date,
        description: parsed.description,
        accountId: parsed.accountId,
        transferAccountId: "",
        categoryId: parsed.categoryId ?? "",
        notes: "",
        tags: parsed.tags.join(", "),
      },
      { userId, spaceId },
      label,
    ).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      toast.error("Non sono riuscito a registrarlo: completa i dati nel modulo.");
      openFullForm();
      return;
    }
    if (res.queued) toast.success(`Salvato offline: ${label}. Lo sincronizzo appena torni online.`);
    else toast.success(`Registrato: ${label}`);
    res.warnings?.forEach((w) =>
      toast.warning(amountsHidden ? maskAmounts(w) : w, { duration: 7000 }),
    );
    setText("");
  }

  function openFullForm() {
    setPrefill(toDTO());
    setFormOpen(true);
  }

  return (
    <section
      aria-label="Inserimento rapido"
      className="bg-card rounded-xl border p-3 focus-within:border-violet-400/60 focus-within:shadow-[0_0_0_4px_rgb(139_92_246/0.12),0_16px_40px_-16px_rgb(139_92_246/0.5)]"
    >
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Zap className="ml-1 size-4 shrink-0 text-violet-500 dark:text-violet-300" aria-hidden />
        <Input
          id={INPUT_ID}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            dictation.listening ? "Ti ascolto…" : "Scrivi un movimento, es. «35 benzina ieri»"
          }
          aria-label="Inserimento rapido: scrivi importo, cosa e quando"
          aria-describedby="quick-entry-hint"
          autoComplete="off"
          enterKeyHint="done"
          className="border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <kbd className="text-muted-foreground hidden rounded border px-1.5 py-0.5 text-[10px] sm:block">
          /
        </kbd>
        {dictation.supported && (
          <Button
            type="button"
            size="sm"
            variant={dictation.listening ? "destructive" : "ghost"}
            aria-label={dictation.listening ? "Smetti di ascoltare" : "Detta il movimento"}
            aria-pressed={dictation.listening}
            title="Detta il movimento"
            onClick={dictation.listening ? dictation.stop : dictation.start}
          >
            <Mic className={cn(dictation.listening && "motion-safe:animate-pulse")} />
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!parsed || pending} aria-label="Registra">
          <CornerDownLeft />
        </Button>
      </form>

      {parsed ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2" aria-live="polite">
          <Chip>
            <span className={parsed.type === "INCOME" ? "text-(--delta-good)" : undefined}>
              {parsed.type === "INCOME" ? "Entrata" : "Uscita"}
            </span>
          </Chip>
          <Chip muted={!parsed.amount}>
            {parsed.amount ? (
              <span className="font-medium">{money(parsed.amount, account?.currency)}</span>
            ) : (
              "Manca l'importo"
            )}
          </Chip>
          {workTime && (
            <Chip>
              <Hourglass className="size-3.5" aria-hidden />
              {workTime} di lavoro
            </Chip>
          )}
          <Chip>{parsed.description}</Chip>
          <Chip muted={!category}>
            {category ? (
              <>
                <CategoryIcon name={category.icon} color={category.color} size="sm" />
                {"parent" in category ? `${category.parent} › ${category.name}` : category.name}
              </>
            ) : (
              "Senza categoria"
            )}
          </Chip>
          <Chip>
            <CalendarDays className="size-3.5" aria-hidden />
            {relativeDay(parsed.date, context.today)}
          </Chip>
          {account && (
            <Chip>
              <Wallet className="size-3.5" aria-hidden />
              {account.name}
            </Chip>
          )}
          {parsed.tags.map((t) => (
            <Chip key={t}>#{t}</Chip>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-auto"
            onClick={openFullForm}
          >
            <Pencil data-icon="inline-start" />
            Modifica
          </Button>
        </div>
      ) : (
        <p id="quick-entry-hint" className="text-muted-foreground mt-1 px-1 text-xs">
          Importo, cosa e quando: capisco date come «ieri» o «lunedì», il conto («contanti»,
          «carta») e i #tag.
        </p>
      )}

      {formOpen && (
        <TransactionFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={() => setText("")}
          prefill={prefill}
          accounts={accounts}
          categories={categories}
        />
      )}
    </section>
  );
}
