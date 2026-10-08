import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { getInvestments } from "@/lib/data/investments";
import { PERSONAL_TAG } from "@/lib/data/split";
import { pickShared, readShares, type PersonalSummary } from "@/lib/finance/together";
import { formatMonth, todayInAppTimeZone, utcDate } from "@/lib/dates";

// The money at hand: everyday accounts and savings. Investments are shown on their own.
const LIQUID_TYPES = new Set(["CHECKING", "CARD", "CASH", "SAVINGS"]);
const cents = (n: number) => Math.round(n * 100) / 100;
const firstName = (u: { name: string | null; email: string }) =>
  u.name?.split(" ")[0] || u.email.split("@")[0];

/**
 * The user's personal space: the oldest space they own with no one else in it. A space shared
 * with someone is "ours", not "mine", even if it was the personal one.
 */
export function soloSpace(userId: string) {
  return prisma.household.findFirst({
    where: { ownerId: userId, members: { every: { userId } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, currency: true },
  });
}

/** Everything a personal space adds up to. Only `pickShared` decides what of it leaves. */
export async function personalSummary(userId: string): Promise<PersonalSummary | null> {
  const space = await soloSpace(userId);
  if (!space) return null;
  const t = todayInAppTimeZone();
  const lastMonth = utcDate(t.year, t.month - 1, 1);
  const thisMonth = utcDate(t.year, t.month, 1);

  const [accounts, investments, goals, totals] = await Promise.all([
    getAccountsWithBalances(space.id),
    getInvestments(space.id),
    prisma.goal.findMany({
      where: { householdId: space.id },
      orderBy: { createdAt: "asc" },
      select: { name: true, targetAmount: true, currentAmount: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: {
        householdId: space.id,
        type: { in: ["INCOME", "EXPENSE"] },
        date: { gte: lastMonth, lt: thisMonth },
      },
      _sum: { baseAmount: true },
    }),
  ]);

  const liquid = accounts.filter((a) => LIQUID_TYPES.has(a.type) && !a.archived);
  const total = (type: string) => Number(totals.find((r) => r.type === type)?._sum.baseAmount ?? 0);
  const income = total("INCOME");
  const saved = income - total("EXPENSE");
  return {
    currency: space.currency,
    balance: liquid.length ? cents(liquid.reduce((s, a) => s + a.baseBalance, 0)) : null,
    savings:
      totals.length > 0
        ? {
            month: formatMonth(lastMonth),
            saved: cents(saved),
            rate: income > 0 ? saved / income : null,
          }
        : null,
    investments: investments.total ? cents(investments.total.value) : null,
    goals: goals.length
      ? goals.map((g) => ({
          name: g.name,
          progress: Math.min(1, Number(g.currentAmount) / Number(g.targetAmount)),
        }))
      : null,
  };
}

/**
 * "Mio, tuo, nostro" for a member of a shared space: the space's own figures, the member's
 * personal space in full (it's theirs), and of everyone else only what they chose to show.
 */
export async function getTogether(userId: string, householdId: string) {
  const t = todayInAppTimeZone();
  const thisMonth = utcDate(t.year, t.month, 1);

  const [household, members, accounts, spent, goals] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { name: true, currency: true },
    }),
    prisma.householdMember.findMany({
      where: { householdId },
      orderBy: { joinedAt: "asc" },
      select: { userId: true, shares: true, user: { select: { name: true, email: true } } },
    }),
    getAccountsWithBalances(householdId),
    prisma.transaction.aggregate({
      where: {
        householdId,
        type: "EXPENSE",
        date: { gte: thisMonth },
        NOT: { tags: { has: PERSONAL_TAG } },
      },
      _sum: { baseAmount: true },
    }),
    prisma.goal.findMany({
      where: { householdId },
      orderBy: { createdAt: "asc" },
      select: { name: true, targetAmount: true, currentAmount: true },
    }),
  ]);

  const me = members.find((m) => m.userId === userId);
  if (!me) throw new Error("Not a member of this space");
  const others = members.filter((m) => m.userId !== userId);
  const liquid = accounts.filter((a) => LIQUID_TYPES.has(a.type) && !a.archived);

  const [mine, theirs] = await Promise.all([
    personalSummary(userId),
    Promise.all(
      others.map(async (m) => {
        const shares = readShares(m.shares);
        // Nothing chosen: their space isn't even read.
        const summary = shares.length ? await personalSummary(m.userId) : null;
        return {
          name: firstName(m.user),
          shares,
          summary: summary ? pickShared(summary, shares) : null,
        };
      }),
    ),
  ]);

  return {
    spaceName: household.name,
    shared: members.length > 1,
    ours: {
      currency: household.currency,
      balance: cents(liquid.reduce((s, a) => s + a.baseBalance, 0)),
      spentThisMonth: cents(Number(spent._sum.baseAmount ?? 0)),
      monthName: formatMonth(thisMonth),
      goals: goals.map((g) => ({
        name: g.name,
        current: Number(g.currentAmount),
        target: Number(g.targetAmount),
      })),
    },
    mine,
    myShares: readShares(me.shares),
    others: theirs,
  };
}

export type Together = Awaited<ReturnType<typeof getTogether>>;
