import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { suggestedMonthlyContribution } from "@/lib/finance/planning";
import { todayInAppTimeZone } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

export const getGoals = cache(async (householdId: string) => {
  const today = todayInAppTimeZone();
  const todayIso = toDateInputValue(new Date(Date.UTC(today.year, today.month, today.day)));
  const goals = await prisma.goal.findMany({
    where: { householdId },
    orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  return goals
    .map((g) => {
      const target = Number(g.targetAmount);
      const current = Number(g.currentAmount);
      const targetDate = g.targetDate ? toDateInputValue(g.targetDate) : null;
      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        color: g.color,
        targetAmount: target,
        currentAmount: current,
        targetDate,
        progress: Math.min(1, current / target),
        completed: current >= target,
        overdue: targetDate !== null && targetDate < todayIso && current < target,
        suggestedMonthly: suggestedMonthlyContribution(current, target, g.targetDate, today),
      };
    })
    .sort((a, b) => Number(a.completed) - Number(b.completed));
});

export type GoalWithProgress = Awaited<ReturnType<typeof getGoals>>[number];
