import { describe, expect, it } from "vitest";
import { buildCashFlow, buildHeatmap, netWorthSeries, weekdayIndex } from "./analytics";
import type { Slice } from "./dashboard-math";

const slice = (name: string, value: number): Slice => ({
  id: name,
  name,
  color: null,
  value,
  share: 0,
});

describe("buildCashFlow", () => {
  it("routes income through the hub to expenses and savings", () => {
    const flow = buildCashFlow(
      [slice("Stipendio", 2000)],
      [slice("Casa", 900), slice("Spesa", 400)],
    );
    expect(flow.nodes.map((n) => [n.name, n.kind, n.value])).toEqual([
      ["Stipendio", "income", 2000],
      ["Disponibile", "hub", 2000],
      ["Casa", "expense", 900],
      ["Spesa", "expense", 400],
      ["Risparmio", "savings", 700],
    ]);
    expect(flow.links).toEqual([
      { source: 0, target: 1, value: 2000 },
      { source: 1, target: 2, value: 900 },
      { source: 1, target: 3, value: 400 },
      { source: 1, target: 4, value: 700 },
    ]);
    expect(flow.net).toBe(700);
  });

  it("adds a savings withdrawal source when spending exceeds income", () => {
    const flow = buildCashFlow([slice("Stipendio", 1000)], [slice("Casa", 1300)]);
    expect(flow.nodes.map((n) => n.kind)).toEqual(["income", "deficit", "hub", "expense"]);
    expect(flow.nodes[1].value).toBe(300);
    const intoHub = flow.links.filter((l) => l.target === 2).reduce((s, l) => s + l.value, 0);
    const outOfHub = flow.links.filter((l) => l.source === 2).reduce((s, l) => s + l.value, 0);
    expect(intoHub).toBe(outOfHub);
  });

  it("handles a month with expenses only", () => {
    const flow = buildCashFlow([], [slice("Casa", 500)]);
    expect(flow.nodes.map((n) => n.kind)).toEqual(["deficit", "hub", "expense"]);
  });
});

describe("buildHeatmap", () => {
  // Thursday 2026-09-24
  const end = new Date("2026-09-24T00:00:00Z");

  it("starts columns on Monday and ends on the week of the end date", () => {
    const map = buildHeatmap([], end, 2);
    expect(map.columns).toHaveLength(2);
    expect(map.columns[0][0]?.date).toBe("2026-09-14"); // Monday
    expect(map.columns[1][3]?.date).toBe("2026-09-24");
    expect(map.columns[1][4]).toBeNull(); // Friday is in the future
    expect(weekdayIndex(end)).toBe(3);
  });

  it("assigns quartile levels and computes stats", () => {
    const days = [
      { date: "2026-09-21", amount: 10, count: 1 },
      { date: "2026-09-22", amount: 20, count: 2 },
      { date: "2026-09-23", amount: 30, count: 1 },
      { date: "2026-09-24", amount: 750, count: 1 },
    ];
    const map = buildHeatmap(days, end, 1);
    expect(map.columns[0].slice(0, 4).map((c) => c?.level)).toEqual([1, 2, 3, 4]);
    expect(map.stats).toMatchObject({ days: 4, noSpendDays: 0, total: 810 });
    expect(map.stats.maxDay?.date).toBe("2026-09-24");
  });

  it("keeps days before tracking started out of the stats", () => {
    const map = buildHeatmap(
      [{ date: "2026-09-23", amount: 40, count: 1 }],
      end,
      1,
      new Date("2026-09-23T00:00:00Z"),
    );
    expect(map.columns[0].slice(0, 4).map((c) => c?.beforeTracking)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(map.stats).toMatchObject({ days: 2, noSpendDays: 1, averagePerDay: 20 });
  });

  it("marks days without spending as level 0", () => {
    const map = buildHeatmap([{ date: "2026-09-22", amount: 5, count: 1 }], end, 1);
    expect(map.columns[0].slice(0, 4).map((c) => c?.level)).toEqual([0, 1, 0, 0]);
    expect(map.stats.noSpendDays).toBe(3);
  });
});

describe("netWorthSeries", () => {
  it("accumulates flows on top of the opening total", () => {
    const series = netWorthSeries(
      1000,
      [
        { date: "2026-08-31", net: 50 }, // before the window: included in the starting value
        { date: "2026-09-01", net: -100 },
        { date: "2026-09-03", net: 200 },
      ],
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-09-04T00:00:00Z"),
    );
    expect(series).toEqual([
      { date: "2026-09-01", value: 950 },
      { date: "2026-09-02", value: 950 },
      { date: "2026-09-03", value: 1150 },
      { date: "2026-09-04", value: 1150 },
    ]);
  });

  it("downsamples long ranges but keeps the last day", () => {
    const series = netWorthSeries(
      0,
      [{ date: "2026-09-24", net: 10 }],
      new Date("2025-09-25T00:00:00Z"),
      new Date("2026-09-24T00:00:00Z"),
      50,
    );
    expect(series.length).toBeLessThanOrEqual(51);
    expect(series.at(-1)).toEqual({ date: "2026-09-24", value: 10 });
  });
});
