import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Amount } from "@/components/amount";
import { INVESTMENT_SLOTS, slotColor } from "@/lib/account-types";
import { cn } from "@/lib/utils";

const percent = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const share = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0 });

/** Gain or loss: arrow, sign and colour together, so the colour is never the only cue. */
export function GainBadge({
  gain,
  pct,
  currency,
  className,
}: {
  gain: number;
  pct: number | null;
  /** The account's currency; the space's one when omitted. */
  currency?: string;
  className?: string;
}) {
  const Icon = gain > 0 ? ArrowUpRight : gain < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular-nums",
        gain > 0 && "text-(--delta-good)",
        gain < 0 && "text-(--delta-bad)",
        gain === 0 && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {gain > 0 && "+"}
      <Amount value={gain} currency={currency} />
      {pct !== null && <span className="ml-1">({percent.format(pct)})</span>}
    </span>
  );
}

type Slice = { id: string; name: string; slot: number; share: number };

/**
 * How the investments are split between the accounts: one bar, each account in its fixed colour
 * with a 2px gap between parts, and a legend naming every part with its share. Accounts past the
 * seventh fold into "Altri".
 */
export function AllocationBar({ slices, className }: { slices: Slice[]; className?: string }) {
  const rest = slices.filter((s) => s.slot >= INVESTMENT_SLOTS);
  const parts = [
    ...slices.filter((s) => s.slot < INVESTMENT_SLOTS),
    ...(rest.length
      ? [
          {
            id: "altri",
            name: "Altri",
            slot: INVESTMENT_SLOTS,
            share: rest.reduce((s, r) => s + r.share, 0),
          },
        ]
      : []),
  ].filter((p) => p.share > 0);
  if (parts.length < 2) return null;

  return (
    <div className={cn("grid gap-2.5", className)}>
      <div
        role="img"
        aria-label={`Ripartizione: ${parts.map((p) => `${p.name} ${share.format(p.share)}`).join(", ")}`}
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
      >
        {parts.map((p) => (
          <span
            key={p.id}
            className="h-full min-w-1"
            style={{ flex: `${p.share} 1 0`, background: slotColor(p.slot) }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: slotColor(p.slot) }}
            />
            <span>{p.name}</span>
            <span className="text-muted-foreground tabular-nums">{share.format(p.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Point = { date: string; value: number; invested: number };

/**
 * A small chart of the value (accent line on a light wash) over what was put in (grey dashed
 * line), on the same scale. It draws itself left to right; a dot marks today. Decorative: the
 * numbers it shows are written next to it.
 */
export function ValueSparkline({
  id,
  points,
  className,
}: {
  /** Unique on the page (SVG gradient and clip ids). */
  id: string;
  points: Point[];
  className?: string;
}) {
  if (points.length < 2) return null;
  const W = 600;
  const H = 120;
  const PAD = 8;
  const all = points.flatMap((p) => [p.value, p.invested]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - 2 * PAD);
  const line = (key: "value" | "invested") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const last = points[points.length - 1];

  return (
    <div aria-hidden className={cn("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-full w-full">
        <defs>
          <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <rect className="app-reveal" x="0" y="0" width={W} height={H} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id}-clip)`}>
          <path d={`${line("value")}L${W},${H}L0,${H}Z`} fill={`url(#${id}-wash)`} />
          <path
            d={line("invested")}
            fill="none"
            stroke="var(--viz-ref)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={line("value")}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      <span
        className="app-reveal-dot absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--card-solid)"
        style={{ left: "100%", top: `${(y(last.value) / H) * 100}%`, background: "var(--primary)" }}
      />
    </div>
  );
}
