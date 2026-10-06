import { describe, expect, it } from "vitest";
import {
  downsample,
  investmentPosition,
  investmentSeries,
  sumSeries,
  type InvestmentMovement,
} from "./investments";

const contribution = (date: string, amount: number): InvestmentMovement => ({
  date,
  amount,
  kind: "contribution",
});
const ret = (date: string, amount: number): InvestmentMovement => ({
  date,
  amount,
  kind: "return",
});

describe("investmentPosition", () => {
  it("without values entered, it's worth what was put in", () => {
    const p = investmentPosition(1000, [contribution("2026-02-01", 200)], []);
    expect(p).toEqual({ invested: 1200, value: 1200, gain: 0, gainPct: 0, valuedAt: null });
  });

  it("uses the last value entered, plus what was put in afterwards", () => {
    const p = investmentPosition(
      1000,
      [contribution("2026-01-10", 500), contribution("2026-03-10", 200)],
      [
        { date: "2026-01-31", value: 1450 },
        { date: "2026-02-28", value: 1600 },
      ],
    );
    expect(p.invested).toBe(1700);
    expect(p.value).toBe(1800);
    expect(p.gain).toBe(100);
    expect(p.gainPct).toBeCloseTo(100 / 1700);
    expect(p.valuedAt).toBe("2026-02-28");
  });

  it("counts a movement on the day of a value as already included", () => {
    const p = investmentPosition(
      0,
      [contribution("2026-05-02", 300)],
      [{ date: "2026-05-02", value: 310 }],
    );
    expect(p.value).toBe(310);
    expect(p.gain).toBe(10);
  });

  it("counts dividends and fees as gain and loss, withdrawals as money taken out", () => {
    const p = investmentPosition(
      2000,
      [ret("2026-04-01", 40), ret("2026-04-02", -5), contribution("2026-04-03", -500)],
      [],
    );
    expect(p.invested).toBe(1500);
    expect(p.value).toBe(1535);
    expect(p.gain).toBe(35);
  });

  it("has no percentage when nothing was put in", () => {
    expect(investmentPosition(0, [], []).gainPct).toBeNull();
  });
});

describe("investmentSeries", () => {
  it("follows what was put in when no value was entered", () => {
    const s = investmentSeries(
      100,
      [contribution("2026-01-02", 50)],
      [],
      "2026-01-01",
      "2026-01-03",
    );
    expect(s).toEqual([
      { date: "2026-01-01", invested: 100, value: 100 },
      { date: "2026-01-02", invested: 150, value: 150 },
      { date: "2026-01-03", invested: 150, value: 150 },
    ]);
  });

  it("moves the gain in a straight line from zero to the first value, then stays put", () => {
    const s = investmentSeries(
      1000,
      [],
      [{ date: "2026-01-05", value: 1040 }],
      "2026-01-01",
      "2026-01-07",
    );
    expect(s.map((p) => p.value)).toEqual([1000, 1010, 1020, 1030, 1040, 1040, 1040]);
    expect(s.every((p) => p.invested === 1000)).toBe(true);
  });

  it("interpolates between two values and adds contributions as they happen", () => {
    const s = investmentSeries(
      1000,
      [contribution("2026-01-03", 100)],
      [
        { date: "2026-01-01", value: 1000 },
        { date: "2026-01-05", value: 1140 },
      ],
      "2026-01-01",
      "2026-01-05",
    );
    // Unexplained part: 0 on the 1st, 1140 - 1100 = 40 on the 5th.
    expect(s.map((p) => p.value)).toEqual([1000, 1010, 1120, 1130, 1140]);
    expect(s.map((p) => p.invested)).toEqual([1000, 1000, 1100, 1100, 1100]);
  });

  it("ends on the same value as the position", () => {
    const movements = [contribution("2026-02-10", 300), ret("2026-03-01", 12)];
    const valuations = [{ date: "2026-02-20", value: 1290 }];
    const s = investmentSeries(1000, movements, valuations, "2026-01-01", "2026-03-15");
    expect(s.at(-1)!.value).toBe(investmentPosition(1000, movements, valuations).value);
  });
});

describe("downsample and sumSeries", () => {
  it("keeps the last point", () => {
    const points = Array.from({ length: 10 }, (_, i) => i);
    const sampled = downsample(points, 4);
    expect(sampled.at(-1)).toBe(9);
    expect(sampled.length).toBeLessThanOrEqual(5);
  });

  it("adds series day by day, a later one counting as zero before it starts", () => {
    const a = [
      { date: "2026-01-01", invested: 10, value: 12 },
      { date: "2026-01-02", invested: 10, value: 13 },
    ];
    const b = [{ date: "2026-01-02", invested: 5, value: 4 }];
    expect(sumSeries([a, b])).toEqual([
      { date: "2026-01-01", invested: 10, value: 12 },
      { date: "2026-01-02", invested: 15, value: 17 },
    ]);
  });
});
