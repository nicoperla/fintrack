import { describe, expect, it } from "vitest";
import { computeGamification, computeStreak, levelFor, type GamificationInput } from "./engine";

const days = (from: string, count: number) =>
  Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
  );

describe("computeStreak", () => {
  it("counts consecutive days up to today", () => {
    const streak = computeStreak(days("2026-09-20", 6), "2026-09-25");
    expect(streak).toMatchObject({ current: 6, longest: 6, activeToday: true });
  });

  it("keeps the streak alive when only yesterday was recorded", () => {
    const streak = computeStreak(days("2026-09-20", 5), "2026-09-25");
    expect(streak).toMatchObject({ current: 5, activeToday: false });
  });

  it("resets after a missed day but remembers the record", () => {
    const streak = computeStreak(
      [...days("2026-09-01", 10), "2026-09-24", "2026-09-25"],
      "2026-09-25",
    );
    expect(streak).toMatchObject({ current: 2, longest: 10 });
    expect(computeStreak(days("2026-09-01", 3), "2026-09-25").current).toBe(0);
  });

  it("returns the last 14 days for the mini calendar", () => {
    const { recent } = computeStreak(["2026-09-25"], "2026-09-25");
    expect(recent).toHaveLength(14);
    expect(recent[0].date).toBe("2026-09-12");
    expect(recent[13]).toEqual({ date: "2026-09-25", active: true });
  });
});

describe("levelFor", () => {
  it("maps XP to levels with progress to the next one", () => {
    expect(levelFor(0)).toMatchObject({ level: 1, name: "Principiante", nextMin: 100 });
    expect(levelFor(175)).toMatchObject({ level: 2, progress: 0.5 });
    expect(levelFor(9999)).toMatchObject({
      level: 7,
      name: "Leggenda",
      nextMin: null,
      progress: 1,
    });
  });
});

describe("computeGamification", () => {
  const base: GamificationInput = {
    activityDays: [],
    today: "2026-09-25",
    transactionCount: 0,
    importedCount: 0,
    budgetCount: 0,
    completedGoals: 0,
    months: [],
    lastMonthWithinBudget: null,
  };

  it("starts with nothing unlocked", () => {
    const result = computeGamification(base);
    expect(result.unlocked).toBe(0);
    expect(result.level.level).toBe(1);
  });

  it("unlocks badges and adds XP", () => {
    const result = computeGamification({
      ...base,
      activityDays: days("2026-09-17", 9),
      transactionCount: 120,
      budgetCount: 2,
      completedGoals: 1,
      months: [{ month: "2026-08", income: 2000, expense: 1500 }],
      lastMonthWithinBudget: true,
    });
    const unlocked = result.badges.filter((b) => b.unlocked).map((b) => b.id);
    expect(unlocked).toEqual([
      "first-step",
      "week-streak",
      "hundred",
      "planner",
      "on-track",
      "saver",
      "goal",
    ]);
    // 120*2 + 9*5 + 7*50
    expect(result.level.xp).toBe(635);
    expect(result.level.name).toBe("Organizzato");
  });

  it("reports progress on locked badges", () => {
    const result = computeGamification({
      ...base,
      activityDays: days("2026-09-22", 4),
      transactionCount: 40,
    });
    expect(result.badges.find((b) => b.id === "week-streak")?.progress).toEqual({
      value: 4,
      target: 7,
    });
    expect(result.badges.find((b) => b.id === "hundred")?.progress).toEqual({
      value: 40,
      target: 100,
    });
  });
});
