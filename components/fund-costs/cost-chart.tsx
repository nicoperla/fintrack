"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useAmountsHidden, useMoney } from "@/components/currency-provider";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";

const axisNumber = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
});

type Point = { year: number; gross: number; net: number; reference: number | null };

function ChartTooltip({ active, payload, currency }: TooltipContentProps & { currency: string }) {
  const money = useMoney();
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 grid gap-0.5 rounded-lg px-3 py-2 text-xs shadow-md ring-1">
      <p className="text-muted-foreground">
        {point.year === 0 ? "Oggi" : `Tra ${point.year} anni`}
      </p>
      <p className="tabular-nums">Senza costi: {money(point.gross, currency)}</p>
      <p className="font-medium tabular-nums">Con i suoi costi: {money(point.net, currency)}</p>
      {point.reference !== null && (
        <p className="text-muted-foreground tabular-nums">
          Con la media di categoria: {money(point.reference, currency)}
        </p>
      )}
    </div>
  );
}

/** Year by year: the value without costs, with the product's costs and with the category's. */
export function CostChart({
  gross,
  net,
  reference,
  currency,
}: {
  gross: number[];
  net: number[];
  reference: number[] | null;
  currency: string;
}) {
  const hidden = useAmountsHidden();
  const reduceMotion = usePrefersReducedMotion();
  const points: Point[] = gross.map((g, year) => ({
    year,
    gross: g,
    net: net[year],
    reference: reference ? reference[year] : null,
  }));

  return (
    <div
      className="h-52 w-full"
      role="img"
      aria-label="Valore negli anni, senza costi e con i costi del prodotto"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="year"
            type="number"
            domain={[0, gross.length - 1]}
            ticks={[0, 10, 20, 30]}
            tickFormatter={(y: number) => (y === 0 ? "oggi" : `${y} anni`)}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickMargin={8}
          />
          <YAxis
            width={44}
            tickFormatter={(v: number) => (hidden ? "" : axisNumber.format(v))}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            content={(props) => <ChartTooltip {...props} currency={currency} />}
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="gross"
            stroke="var(--viz-other)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {reference && (
            <Line
              dataKey="reference"
              stroke="var(--viz-income)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            dataKey="net"
            stroke="var(--viz-expense)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={!reduceMotion}
            animationDuration={700}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
