"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import { AnimatedCurrency } from "@/components/dashboard/animated-currency";
import type { Slice } from "@/lib/finance/dashboard-math";
import { useMoney } from "@/components/currency-provider";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

const percent = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0 });

const sliceColor = (s: Slice) => s.color ?? "var(--viz-other)";

function DonutTooltip({ active, payload }: TooltipContentProps) {
  const money = useMoney();
  const slice = payload?.[0]?.payload as Slice | undefined;
  if (!active || !slice) return null;
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 flex items-center gap-2 rounded-lg px-3 py-2 text-xs shadow-md ring-1">
      <span
        aria-hidden
        className="size-2.5 rounded-sm"
        style={{ backgroundColor: sliceColor(slice) }}
      />
      <span className="font-medium">{slice.name}</span>
      <span className="text-muted-foreground tabular-nums">
        {money(slice.value)} · {percent.format(slice.share)}
      </span>
    </div>
  );
}

export function CategoryDonut({
  slices,
  monthName,
  range,
}: {
  slices: Slice[];
  monthName: string;
  range: { from: string; to: string };
}) {
  const money = useMoney();
  const [active, setActive] = useState<number | null>(null);
  const reduceMotion = usePrefersReducedMotion();
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const hrefFor = (s: Slice) => {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (s.id) params.set("categoryId", s.id);
    else params.set("type", "EXPENSE");
    return `/transactions?${params}`;
  };

  return (
    <section
      className="bg-card flex h-full flex-col gap-4 rounded-xl border p-4"
      aria-labelledby="donut-title"
    >
      <div>
        <h2 id="donut-title" className="font-medium">
          Dove sono andati i soldi
        </h2>
        <p className="text-muted-foreground text-sm">Spese di {monthName} per categoria</p>
      </div>

      {slices.length === 0 ? (
        <p className="text-muted-foreground flex flex-1 items-center justify-center py-12 text-center text-sm">
          Nessuna spesa registrata a {monthName}.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
          <div className="relative size-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={!reduceMotion}
                  animationDuration={900}
                  onMouseEnter={(_, index) => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                >
                  {slices.map((s, i) => (
                    <Cell
                      key={s.id ?? "other"}
                      fill={sliceColor(s)}
                      opacity={active === null || active === i ? 1 : 0.35}
                      className="transition-opacity outline-none"
                    />
                  ))}
                </Pie>
                <Tooltip content={DonutTooltip} isAnimationActive={false} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-muted-foreground text-xs">Totale</span>
              <AnimatedCurrency value={total} className="text-lg font-semibold tracking-tight" />
            </div>
          </div>

          <ul className="grid w-full gap-0.5 text-sm">
            {slices.map((s, i) => (
              <li key={s.id ?? "other"}>
                <Link
                  href={hrefFor(s)}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className={cn(
                    "hover:bg-muted/60 flex items-center gap-2 rounded-md px-2 py-1.5 transition-opacity",
                    active !== null && active !== i && "opacity-50",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: sliceColor(s) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
                    {percent.format(s.share)}
                  </span>
                  <span className="w-24 text-right font-medium tabular-nums">{money(s.value)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
