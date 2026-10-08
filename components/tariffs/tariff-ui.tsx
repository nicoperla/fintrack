"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, Lightbulb, type LucideIcon } from "lucide-react";
import { MASKED_AMOUNT, useAmountsHidden, useSpaceInfo } from "@/components/currency-provider";
import { formatDayMonth } from "@/components/true-salary/format";
import { currencySymbol, formatWholeCurrency } from "@/lib/format";
import type { Percentiles } from "@/lib/finance/tariff-data";
import type { Verdict } from "@/lib/finance/tariffs";
import { cn } from "@/lib/utils";

/* Pieces shared by the three comparisons of "Il Tariffometro". */

export function Section({
  id,
  icon: Icon,
  title,
  subtitle,
  action,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-20 grid-cols-1 gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-lg font-semibold">
            <Icon className="size-5" aria-hidden /> {title}
          </h2>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card grid grid-cols-1 gap-4 rounded-2xl border p-5", className)}>
      {children}
    </div>
  );
}

const VERDICT_STYLES: Record<Verdict, string> = {
  above: "border-amber-500/40 bg-amber-500/10",
  inline: "border-border bg-muted/30",
  below: "border-emerald-500/40 bg-emerald-500/5",
};

/** The verdict in words, tinted by how it went. */
export function VerdictBox({ verdict, children }: { verdict: Verdict; children: ReactNode }) {
  return (
    <div className={cn("grid gap-1 rounded-xl border p-4 text-sm", VERDICT_STYLES[verdict])}>
      {children}
    </div>
  );
}

const VERDICT_TITLES: Record<Verdict, string> = {
  above: "Sopra la media",
  inline: "In linea con la media",
  below: "Sotto la media",
};

/** For the light, compared with ARERA's reference price rather than an average. */
const REFERENCE_TITLES: Record<Verdict, string> = {
  above: "Sopra il riferimento",
  inline: "In linea con il riferimento",
  below: "Sotto il riferimento",
};

export function VerdictBadge({
  verdict,
  reference = false,
}: {
  verdict: Verdict;
  reference?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        verdict === "above"
          ? "bg-amber-500/15 text-(--warn-text)"
          : verdict === "below"
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            : "bg-muted text-muted-foreground",
      )}
    >
      {(reference ? REFERENCE_TITLES : VERDICT_TITLES)[verdict]}
    </span>
  );
}

/** "412 €": the public figures, rounded, in the space currency (masked in discreet mode). */
export function useWholeMoney() {
  const { currency, hidden } = useSpaceInfo();
  return (n: number) =>
    hidden ? `${MASKED_AMOUNT} ${currencySymbol(currency)}` : formatWholeCurrency(n, currency);
}

/**
 * Where a value falls among what others pay: the band is the middle half (from the 25th to the
 * 75th percentile), the line the average, the dot the user. Low and high ends are the outer
 * percentiles given.
 */
export function DistributionBar({
  value,
  mean,
  percentiles,
  low,
  high,
  format,
  label,
}: {
  value: number;
  mean: number;
  percentiles: Percentiles;
  low: number;
  high: number;
  format: (n: number) => string;
  /** For screen readers: what the bar shows, in words. */
  label: string;
}) {
  const start = Math.min(percentiles[low] ?? 0, value);
  const end = Math.max(percentiles[high] ?? value, value);
  const span = end - start || 1;
  const at = (n: number) => `${((n - start) / span) * 100}%`;
  const q1 = percentiles[25] ?? start;
  const q3 = percentiles[75] ?? end;
  return (
    <figure className="grid gap-2" role="img" aria-label={label}>
      <div className="relative h-8">
        <div className="bg-muted absolute inset-x-0 top-3.5 h-1.5 rounded-full" />
        <div
          className="absolute top-3 h-2.5 rounded-full bg-sky-500/30 dark:bg-sky-400/30"
          style={{ left: at(q1), width: `calc(${at(q3)} - ${at(q1)})` }}
        />
        <div
          className="bg-foreground/60 absolute top-1.5 h-5 w-0.5 rounded-full"
          style={{ left: at(mean) }}
        />
        <div
          className="bg-primary ring-background absolute top-2 size-4 -translate-x-1/2 rounded-full ring-2"
          style={{ left: at(value) }}
        />
      </div>
      <figcaption className="text-muted-foreground flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
        <span>
          <span className="bg-primary mr-1 inline-block size-2 rounded-full align-middle" />
          Tu
        </span>
        <span>
          <span className="bg-foreground/60 mr-1 inline-block h-2.5 w-0.5 align-middle" />
          Media {format(mean)}
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-3 rounded-full bg-sky-500/30 align-middle dark:bg-sky-400/30" />
          Metà paga tra {format(q1)} e {format(q3)}
        </span>
      </figcaption>
    </figure>
  );
}

export type Move = { text: ReactNode; href?: string; linkLabel?: string };

/** "Come pagare meno": the steps, with links to public comparators only. */
export function Moves({ moves, open }: { moves: Move[]; open: boolean }) {
  return (
    <details open={open} className="group rounded-xl border p-4 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <Lightbulb className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
        Come pagare meno
        <span className="text-muted-foreground ml-auto text-xs font-normal group-open:hidden">
          Mostra
        </span>
        <span className="text-muted-foreground ml-auto hidden text-xs font-normal group-open:inline">
          Nascondi
        </span>
      </summary>
      <ol className="mt-3 grid list-decimal gap-2 pl-5">
        {moves.map((m, i) => (
          <li key={i}>
            {m.text}
            {m.href && (
              <>
                {" "}
                <a
                  href={m.href}
                  target={m.href.startsWith("http") ? "_blank" : undefined}
                  rel={m.href.startsWith("http") ? "noreferrer" : undefined}
                  className="inline-flex items-center gap-0.5 font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                >
                  {m.linkLabel ?? "Apri"}
                  {m.href.startsWith("http") && <ArrowUpRight className="size-3.5" aria-hidden />}
                </a>
              </>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

const unitPrice = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** "0,359 €/kWh". */
export function useKwhPrice() {
  const hidden = useAmountsHidden();
  return (price: number, mask = true) =>
    `${hidden && mask ? MASKED_AMOUNT : unitPrice.format(price)} €/kWh`;
}

const kwhFormat = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 0,
  useGrouping: "always",
});
export const formatKwh = (kwh: number) => `${kwhFormat.format(kwh)} kWh`;

/** "dal 15 dicembre", "dall'1 luglio": the numbers read with a leading vowel sound. */
export const fromDate = (iso: string) =>
  `${[1, 8, 11].includes(Number(iso.slice(8, 10))) ? "dall'" : "dal "}${formatDayMonth(iso)}`;
