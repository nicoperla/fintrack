"use client";

import { useEffect, useRef, useState } from "react";
import type { HeatCell } from "@/lib/finance/analytics";
import { useMoney } from "@/components/currency-provider";
import { cn } from "@/lib/utils";

type HeatmapData = {
  columns: (HeatCell | null)[][];
  months: { label: Date; column: number }[];
  thresholds: number[];
  stats: {
    total: number;
    days: number;
    noSpendDays: number;
    averagePerDay: number;
    maxDay: { date: string; amount: number } | null;
  };
};

const CELL = 13;
const GAP = 3;
const STEP = CELL + GAP;
const WEEKDAY_LABELS = ["Lun", "", "Mer", "", "Ven", "", ""];

const monthShort = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" });
const dayLong = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function SpendingHeatmap({ data }: { data: HeatmapData }) {
  const money = useMoney();
  const [hover, setHover] = useState<{ cell: HeatCell; x: number; y: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // On narrow screens the grid scrolls: start at the most recent weeks.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);
  const { stats } = data;
  const width = data.columns.length * STEP;

  const legend = [0, 1, 2, 3, 4].map((level) => (
    <span
      key={level}
      aria-hidden
      className="rounded-[3px]"
      style={{ width: CELL - 2, height: CELL - 2, backgroundColor: `var(--heat-${level})` }}
    />
  ));

  return (
    <section
      className="bg-card flex flex-col gap-4 rounded-xl border p-4"
      aria-labelledby="heatmap-title"
    >
      <div>
        <h2 id="heatmap-title" className="font-medium">
          Calendario delle spese
        </h2>
        <p className="text-muted-foreground text-sm">
          Quanto hai speso ogni giorno negli ultimi 6 mesi
        </p>
      </div>

      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          role="img"
          aria-label={`Calendario delle spese: ${money(stats.total)} in ${stats.days} giorni, ${stats.noSpendDays} giorni senza spese.`}
          className="relative w-max"
          onMouseLeave={() => setHover(null)}
        >
          <div className="text-muted-foreground relative ml-8 h-4 text-[11px]" style={{ width }}>
            {data.months.map((m) => (
              <span key={m.column} className="absolute" style={{ left: m.column * STEP }}>
                {monthShort.format(m.label).replace(".", "")}
              </span>
            ))}
          </div>
          <div className="flex">
            <div
              className="text-muted-foreground mr-1 flex w-7 flex-col text-[10px]"
              style={{ gap: GAP }}
            >
              {WEEKDAY_LABELS.map((label, i) => (
                <span key={i} style={{ height: CELL, lineHeight: `${CELL}px` }}>
                  {label}
                </span>
              ))}
            </div>
            <div className="flex" style={{ gap: GAP }}>
              {data.columns.map((column, c) => (
                <div key={c} className="flex flex-col" style={{ gap: GAP }}>
                  {column.map((cell, r) =>
                    cell ? (
                      <span
                        key={r}
                        aria-hidden
                        onMouseEnter={(e) => {
                          const box = e.currentTarget.getBoundingClientRect();
                          setHover({ cell, x: box.left + box.width / 2, y: box.top });
                        }}
                        className={cn(
                          "rounded-[3px] transition-transform hover:scale-125",
                          cell.beforeTracking && "opacity-40",
                          hover?.cell.date === cell.date && "ring-foreground/40 ring-1",
                        )}
                        style={{
                          width: CELL,
                          height: CELL,
                          backgroundColor: `var(--heat-${cell.level})`,
                        }}
                      />
                    ) : (
                      <span key={r} aria-hidden style={{ width: CELL, height: CELL }} />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {hover && (
        <div
          role="tooltip"
          className="bg-popover text-popover-foreground ring-foreground/10 pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg px-3 py-2 text-xs shadow-md ring-1"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          <p className="font-medium capitalize">{dayLong.format(parse(hover.cell.date))}</p>
          <p className="text-muted-foreground">
            {hover.cell.beforeTracking
              ? "Nessun dato: non usavi ancora FinTrack"
              : hover.cell.amount > 0
                ? `${money(hover.cell.amount)} · ${hover.cell.count} ${hover.cell.count === 1 ? "movimento" : "movimenti"}`
                : "Nessuna spesa"}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          Meno {legend} Più
        </div>
        <p className="text-muted-foreground text-xs">
          Le 4 tonalità dividono i giorni con spese in quarti: fino a{" "}
          {data.thresholds.map((t) => money(t)).join(", ")} e oltre.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground text-xs">Media al giorno</dt>
          <dd className="font-medium">{money(stats.averagePerDay)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Giorni senza spese</dt>
          <dd className="font-medium">
            {stats.noSpendDays} su {stats.days}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground text-xs">Giorno più costoso</dt>
          <dd className="font-medium">
            {stats.maxDay
              ? `${dayLong.format(parse(stats.maxDay.date))} · ${money(stats.maxDay.amount)}`
              : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
