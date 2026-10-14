"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CornerDownLeft, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, FormMessage, SelectField } from "@/components/forms/form-field";
import { Illustration } from "@/components/illustrations";
import { PRIORITY_ICONS, PRIORITY_START } from "@/components/register/priorities";
import {
  completeOnboarding,
  finishOnboarding,
  type OnboardingResult,
} from "@/app/(dashboard)/dashboard/onboarding-actions";
import { saveTransaction } from "@/app/(dashboard)/transactions/actions";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import { CategoryIcon } from "@/lib/category-style";
import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";
import { COACH_PRIORITIES, type CoachPriority } from "@/lib/finance/coach-profile";
import { parseQuickEntry } from "@/lib/quick-entry/parse";
import { todayDateInputValue } from "@/lib/format";
import { useMoney, useCurrencySymbol } from "@/components/currency-provider";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | "done";
type Context = NonNullable<OnboardingResult["context"]>;

const STEP_TITLES = ["Il tuo conto", "Le categorie", "Primo movimento"];

function Steps({ step }: { step: Step }) {
  const current = step === "done" ? 4 : step;
  return (
    <ol className="flex items-center gap-2" aria-label="Passaggi">
      {STEP_TITLES.map((title, i) => {
        const n = i + 1;
        const done = n < current;
        return (
          <li key={title} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                done
                  ? "bg-primary text-primary-foreground"
                  : n === current
                    ? "border-foreground border-2"
                    : "bg-muted text-muted-foreground",
              )}
              aria-current={n === current ? "step" : undefined}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : n}
            </span>
            <span
              className={cn(
                "hidden text-sm sm:inline",
                n === current ? "font-medium" : "text-muted-foreground",
              )}
            >
              {title}
            </span>
            {n < 3 && (
              <span aria-hidden className={cn("h-px flex-1", done ? "bg-primary" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Onboarding({
  name,
  hasCategories,
  priorities = [],
}: {
  name: string | null;
  hasCategories: boolean;
  /** Picked at sign-up: the first one suggests where to go once the account is ready. */
  priorities?: CoachPriority[];
}) {
  const symbol = useCurrencySymbol();
  const money = useMoney();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [account, setAccount] = useState({
    name: "Conto corrente",
    type: "CHECKING",
    initialBalance: "",
  });
  const [selected, setSelected] = useState<string[]>(DEFAULT_CATEGORIES.map((c) => c.name));
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [pending, setPending] = useState(false);
  const [entry, setEntry] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  async function submitSetup() {
    setPending(true);
    const res = await completeOnboarding({
      account,
      categories: hasCategories ? [] : selected,
    }).catch((): OnboardingResult => ({ ok: false, error: "Qualcosa è andato storto. Riprova." }));
    setPending(false);
    if (!res.ok || !res.context) {
      const firstFieldError = Object.values(res.fieldErrors ?? {}).flat()[0];
      setResult({ ok: false, error: res.error ?? firstFieldError ?? "Controlla i dati inseriti." });
      if (res.fieldErrors) setStep(1);
      return;
    }
    setContext(res.context);
    setStep(3);
  }

  function nextFromAccount(event: FormEvent) {
    event.preventDefault();
    if (hasCategories) submitSetup();
    else setStep(2);
  }

  const parsed = useMemo(() => {
    if (!context || !entry.trim()) return null;
    return parseQuickEntry(entry, {
      today: todayDateInputValue(),
      categories: context.categories,
      accounts: [context.account],
      defaultAccountId: context.account.id,
      hints: [],
    });
  }, [entry, context]);

  async function saveFirst(event: FormEvent) {
    event.preventDefault();
    if (!parsed?.amount || !parsed.accountId) return;
    setPending(true);
    const res = await saveTransaction(
      null,
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
      { deferRevalidate: true },
    ).catch(() => null);
    setPending(false);
    if (res?.ok) {
      setSaved(`${parsed.description} · ${money(parsed.amount)}`);
      setStep("done");
    }
  }

  async function finish(href?: string) {
    setPending(true);
    await finishOnboarding();
    if (href) router.push(href);
    else router.refresh();
  }

  const focus = priorities[0];

  const category = parsed?.categoryId
    ? context?.categories.find((c) => c.id === parsed.categoryId)
    : null;

  return (
    <div className="mx-auto grid w-full max-w-xl gap-6 py-4">
      <div className="text-center">
        <p className="text-muted-foreground text-sm">
          Benvenuto su FinTrack{name ? `, ${name.split(" ")[0]}` : ""}!
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Iniziamo in tre passi
        </h1>
      </div>
      <Steps step={step} />

      <div
        key={String(step)}
        className="bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 grid gap-5 rounded-2xl border p-5 duration-300"
      >
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}

        {step === 1 && (
          <form onSubmit={nextFromAccount} className="grid gap-4" noValidate>
            <div className="flex items-center gap-4">
              <Illustration name="wallet" />
              <div>
                <h2 className="font-medium">Il tuo conto principale</h2>
                <p className="text-muted-foreground text-sm">
                  Quello che usi di più: potrai aggiungere carte, contanti e risparmi quando vuoi.
                </p>
              </div>
            </div>
            <FormField
              label="Nome"
              name="name"
              value={account.name}
              onChange={(e) => setAccount({ ...account, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Tipo"
                name="type"
                value={account.type}
                onChange={(e) => setAccount({ ...account, type: e.target.value })}
              >
                {ACCOUNT_TYPE_OPTIONS.map((o) => (
                  <NativeSelectOption key={o.value} value={o.value}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </SelectField>
              <FormField
                label={`Saldo di oggi (${symbol})`}
                name="initialBalance"
                inputMode="decimal"
                placeholder="0,00"
                value={account.initialBalance}
                onChange={(e) => setAccount({ ...account, initialBalance: e.target.value })}
                autoFocus
              />
            </div>
            <Button type="submit" size="lg" disabled={pending || !account.name.trim()}>
              {pending ? "Un attimo…" : "Continua"}
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <div>
              <h2 className="font-medium">Le tue categorie</h2>
              <p className="text-muted-foreground text-sm">
                Ti abbiamo preparato un set di partenza con le sottocategorie più comuni. Tocca per
                togliere quelle che non ti servono: potrai sempre modificarle.
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEFAULT_CATEGORIES.map((c) => {
                const on = selected.includes(c.name);
                return (
                  <li key={c.name}>
                    <label
                      className={cn(
                        "has-focus-visible:ring-ring/50 flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition-colors has-focus-visible:ring-3",
                        on
                          ? "bg-muted/60 border-foreground/20"
                          : "text-muted-foreground opacity-60",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() =>
                          setSelected((s) => (on ? s.filter((n) => n !== c.name) : [...s, c.name]))
                        }
                      />
                      <CategoryIcon name={c.icon} color={on ? c.color : null} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      {on && <Check className="size-3.5 shrink-0" aria-hidden />}
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={pending}>
                Indietro
              </Button>
              <Button size="lg" onClick={submitSetup} disabled={pending}>
                {pending ? "Creazione…" : `Crea ${selected.length} categorie`}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && context && (
          <form onSubmit={saveFirst} className="grid gap-4">
            <div>
              <h2 className="font-medium">Il tuo primo movimento</h2>
              <p className="text-muted-foreground text-sm">
                Scrivilo come lo diresti: importo, cosa e quando. Per esempio «12 pranzo oggi» o «35
                benzina ieri».
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="12 pranzo oggi"
                aria-label="Primo movimento"
                autoFocus
              />
              <Button type="submit" disabled={!parsed?.amount || pending} aria-label="Registra">
                <CornerDownLeft />
              </Button>
            </div>
            {parsed && (
              <p
                className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm"
                aria-live="polite"
              >
                {parsed.amount ? (
                  <>
                    {parsed.type === "INCOME" ? "Entrata" : "Uscita"} di{" "}
                    <span className="text-foreground font-medium">{money(parsed.amount)}</span> ·{" "}
                    {parsed.description}
                    {category && <> · {category.name}</>}
                  </>
                ) : (
                  "Aggiungi un importo, es. «12»"
                )}
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep("done")}
              className="justify-self-start"
            >
              Salta, lo faccio dopo
            </Button>
          </form>
        )}

        {step === "done" && (
          <div className="grid justify-items-center gap-3 py-2 text-center">
            <Illustration name="celebrate" />
            <h2 className="flex items-center gap-2 text-lg font-medium">
              <PartyPopper className="size-5 text-(--viz-expense)" aria-hidden />
              Tutto pronto!
            </h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              {saved
                ? `Hai registrato «${saved}» e sbloccato il tuo primo traguardo. Torna ogni giorno per far crescere la tua streak.`
                : "Il tuo conto è pronto. Registra un movimento quando vuoi: nella dashboard premi / e scrivi, per esempio, «12 pranzo oggi»."}
            </p>
            {focus && <NextStep priority={focus} onGo={finish} disabled={pending} />}
            <Button
              size="lg"
              variant={focus ? "ghost" : "default"}
              onClick={() => finish()}
              disabled={pending}
            >
              Vai alla dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Where to start, from what the user said matters most when signing up. */
function NextStep({
  priority,
  onGo,
  disabled,
}: {
  priority: CoachPriority;
  onGo: (href: string) => void;
  disabled: boolean;
}) {
  const Icon = PRIORITY_ICONS[priority];
  const { href, action } = PRIORITY_START[priority];
  return (
    <button
      type="button"
      onClick={() => onGo(href)}
      disabled={disabled}
      className="hover:bg-muted/60 focus-visible:ring-ring/50 group mt-1 flex w-full max-w-sm items-center gap-3 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 disabled:opacity-50"
    >
      <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block text-xs">
          Per «{COACH_PRIORITIES[priority]}» parti da qui
        </span>
        <span className="block font-medium">{action}</span>
      </span>
      <ArrowRight
        className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}
