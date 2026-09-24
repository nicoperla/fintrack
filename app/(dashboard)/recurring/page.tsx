import Link from "next/link";
import { CalendarClock, Repeat, TrendingUp } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth/session";
import { getRecurring, type RecurringWithCategory } from "@/lib/data/intelligence";
import { CategoryIcon } from "@/lib/category-style";
import { FREQUENCY_LABELS } from "@/lib/finance/recurring";
import { delPct } from "@/lib/finance/insights";
import { formatCurrency } from "@/lib/format";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";

export const metadata = { title: "Abbonamenti · FinTrack" };

const DAY_MS = 86_400_000;
const dayMonth = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function daysUntil(date: string, today: Date) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today.getTime()) / DAY_MS);
}

function whenLabel(date: string, today: Date) {
  const days = daysUntil(date, today);
  if (days < 0) return `atteso il ${dayMonth.format(new Date(`${date}T00:00:00Z`))}`;
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  return `tra ${days} giorni · ${dayMonth.format(new Date(`${date}T00:00:00Z`))}`;
}

function RecurringRow({ item, today }: { item: RecurringWithCategory; today: Date }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <CategoryIcon name={item.category?.icon} color={item.category?.color} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/transactions?${new URLSearchParams({ q: item.name })}`}
          className="block truncate font-medium hover:underline"
        >
          {item.name}
        </Link>
        <p className="text-muted-foreground truncate text-xs">
          {FREQUENCY_LABELS[item.frequency]}
          {item.variableAmount && " · importo variabile"}
          {item.active
            ? ` · prossimo ${whenLabel(item.nextDate, today)}`
            : " · nessun addebito di recente"}
        </p>
        {item.priceChange && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-(--delta-bad)">
            <TrendingUp className="size-3.5" aria-hidden />
            Aumentato {delPct(item.priceChange.pct)}: da {formatCurrency(item.priceChange.from)} a{" "}
            {formatCurrency(item.priceChange.to)}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="font-medium tabular-nums">
          {item.variableAmount && "~"}
          {formatCurrency(item.averageAmount)}
        </p>
        {item.frequency !== "monthly" && (
          <p className="text-muted-foreground text-xs tabular-nums">
            {formatCurrency(item.monthlyCost)}/mese
          </p>
        )}
      </div>
    </li>
  );
}

function Section({
  title,
  description,
  items,
  today,
}: {
  title: string;
  description?: string;
  items: RecurringWithCategory[];
  today: Date;
}) {
  if (items.length === 0) return null;
  return (
    <section className="bg-card rounded-xl border px-4 pt-3 pb-1">
      <h2 className="font-medium">{title}</h2>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
      <ul className="divide-y">
        {items.map((item) => (
          <RecurringRow key={item.key} item={item} today={today} />
        ))}
      </ul>
    </section>
  );
}

export default async function RecurringPage() {
  const user = await requireUser();
  const recurring = await getRecurring(user.id);
  const t = todayInAppTimeZone();
  const today = utcDate(t.year, t.month, t.day);

  const expenses = recurring.filter((r) => r.type === "EXPENSE");
  const active = expenses.filter((r) => r.active);
  const inactive = expenses.filter((r) => !r.active);
  const income = recurring.filter((r) => r.type === "INCOME" && r.active);
  const monthly = active.reduce((s, r) => s + r.monthlyCost, 0);
  const upcoming = active
    .filter((r) => {
      const days = daysUntil(r.nextDate, today);
      return days >= 0 && days <= 30;
    })
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const increases = active.filter((r) => r.priceChange);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Abbonamenti e ricorrenti</h1>
        <p className="text-muted-foreground text-sm">
          Rilevati in automatico dai tuoi movimenti: stessa descrizione, cadenza regolare, importo
          stabile.
        </p>
      </div>

      {recurring.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Nessun movimento ricorrente, per ora"
          description="Servono almeno tre addebiti simili a intervalli regolari (es. Netflix ogni mese). Continua a registrare o importa l'estratto conto."
          action={
            <Link href="/transactions/import" className={buttonVariants({ variant: "outline" })}>
              Importa un CSV
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bg-card rounded-xl border p-4">
              <p className="text-muted-foreground text-sm">Spesa ricorrente al mese</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {formatCurrency(monthly)}
              </p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-muted-foreground text-sm">In un anno</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {formatCurrency(monthly * 12)}
              </p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-muted-foreground text-sm">Attivi</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{active.length}</p>
            </div>
          </div>

          {increases.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-(--delta-bad)/30 bg-(--delta-bad)/5 p-4 text-sm">
              <TrendingUp className="mt-0.5 size-4 shrink-0 text-(--delta-bad)" aria-hidden />
              <p>
                {increases.length === 1
                  ? `${increases[0].name} ha aumentato il prezzo: ora costa ${formatCurrency(increases[0].priceChange!.to)} invece di ${formatCurrency(increases[0].priceChange!.from)}.`
                  : `${increases.length} abbonamenti hanno aumentato il prezzo: ${increases.map((i) => i.name).join(", ")}.`}{" "}
                È un buon momento per chiederti se ti serve ancora.
              </p>
            </div>
          )}

          {upcoming.length > 0 && (
            <section className="bg-card rounded-xl border p-4">
              <h2 className="flex items-center gap-2 font-medium">
                <CalendarClock className="text-muted-foreground size-4" aria-hidden />
                In arrivo nei prossimi 30 giorni
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((r) => (
                  <li
                    key={r.key}
                    className="bg-muted/50 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                  >
                    <CategoryIcon name={r.category?.icon} color={r.category?.color} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {dayMonth.format(new Date(`${r.nextDate}T00:00:00Z`))}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatCurrency(r.averageAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Section title="Uscite ricorrenti" items={active} today={today} />
          <Section
            title="Forse disdetti"
            description="Non vediamo addebiti da più tempo del solito."
            items={inactive}
            today={today}
          />
          <Section title="Entrate ricorrenti" items={income} today={today} />
        </>
      )}
    </div>
  );
}
