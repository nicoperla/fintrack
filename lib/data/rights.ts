import { prisma } from "@/lib/db/prisma";
import { hasPro } from "@/lib/billing/plan";
import { summarizeDeductions, type DeductionType } from "@/lib/finance/deductions";
import { fringeStatus, readTaxProfile, rentDeduction, welfareDeadline } from "@/lib/finance/rights";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

const cents = (n: number) => Math.round(n * 100) / 100;
const RENT = /\baffitto\b|canone di locazione/i;

/**
 * "Radar dei diritti" for one person: their own deductible expenses of a year (the 730 is
 * personal), the rent paid in the space, and their tax profile with the company welfare.
 */
export async function getRightsRadar(userId: string, householdId: string, yearParam?: string) {
  const t = todayInAppTimeZone();
  const today = toDateInputValue(utcDate(t.year, t.month, t.day));
  const [user, household, first] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { taxProfile: true, dependentChildren: true, plan: true },
    }),
    prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { _count: { select: { members: true } } },
    }),
    prisma.transaction.findFirst({
      where: { householdId },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
  ]);
  const firstYear = Math.min(first?.date.getUTCFullYear() ?? t.year, t.year);
  const years = Array.from({ length: t.year - firstYear + 1 }, (_, i) => firstYear + i);
  // The precompilato being filed is last year's; with nothing recorded then, this year's preview.
  const asked = Number(yearParam);
  const year = years.includes(asked) ? asked : years.includes(t.year - 1) ? t.year - 1 : t.year;

  const range = { gte: utcDate(year, 0, 1), lt: utcDate(year + 1, 0, 1) };
  const [own, spaceExpenses] = await Promise.all([
    prisma.transaction.findMany({
      where: { householdId, userId, type: "EXPENSE", date: range },
      select: {
        id: true,
        date: true,
        description: true,
        baseAmount: true,
        deduction: true,
        account: { select: { name: true, type: true } },
        category: { select: { name: true, parent: { select: { name: true } } } },
      },
    }),
    prisma.transaction.findMany({
      where: { householdId, type: "EXPENSE", date: range },
      select: {
        date: true,
        description: true,
        baseAmount: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const deductions = summarizeDeductions(
    own.map((tx) => ({
      id: tx.id,
      date: toDateInputValue(tx.date),
      description: tx.description,
      amount: Number(tx.baseAmount),
      account: tx.account.name,
      accountType: tx.account.type,
      memberId: userId,
      category: tx.category?.name ?? null,
      parent: tx.category?.parent?.name ?? null,
      override: tx.deduction,
    })),
    user.dependentChildren,
  );
  const fintrack: Partial<Record<DeductionType, number>> = Object.fromEntries(
    deductions.byType.map((t) => [t.type, t.eligible]),
  );

  // Rent is often paid by one person for everyone: the space's movements count.
  const rentRows = spaceExpenses.filter(
    (tx) => tx.category?.name === "Affitto" || RENT.test(tx.description),
  );
  const rentPaid = cents(rentRows.reduce((s, tx) => s + Number(tx.baseAmount), 0));
  const months = new Set(rentRows.map((tx) => toDateInputValue(tx.date).slice(0, 7))).size;
  const profile = readTaxProfile(user.taxProfile);

  return {
    year,
    years,
    today,
    currentYear: t.year,
    children: user.dependentChildren,
    shared: household._count.members > 1,
    pro: hasPro(user),
    profile,
    /** The user's expenses that count, by type: what the precompilato should have. */
    fintrack,
    fintrackRefund: deductions.refund,
    toCheck: deductions.toCheck,
    rent: {
      paid: rentPaid,
      months,
      deduction: rentDeduction({ year, profile, rentPaid, months }),
    },
    fringe: fringeStatus(profile.welfare, user.dependentChildren, t.year),
    welfare: welfareDeadline(profile.welfare, today),
  };
}

export type RightsRadar = Awaited<ReturnType<typeof getRightsRadar>>;
