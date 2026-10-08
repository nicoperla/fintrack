import { prisma } from "@/lib/db/prisma";
import { hashShareToken } from "@/lib/family-file-tokens";
import { isShareToken } from "@/lib/family-file";
import { linkExpiry, pactStatus, trackRecord } from "@/lib/finance/pacts";
import { dayInAppTimeZone, todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

const HISTORY = 24;
const DAY_MS = 86_400_000;
const cents = (n: number) => Math.round(n * 100) / 100;
const firstName = (u: { name: string | null; email: string }) =>
  u.name?.split(" ")[0] || u.email.split("@")[0];

export const todayIso = () => {
  const t = todayInAppTimeZone();
  return toDateInputValue(utcDate(t.year, t.month, t.day));
};

type PactRow = {
  householdId: string;
  userId: string;
  categoryId: string;
  periodFrom: Date;
  periodTo: Date;
  onlyMine: boolean;
  category: { children: { id: string }[] };
};

/** What went into the pact's category (and its subcategories) during its period. */
export async function pactSpent(p: PactRow) {
  const sum = await prisma.transaction.aggregate({
    where: {
      householdId: p.householdId,
      type: "EXPENSE",
      categoryId: { in: [p.categoryId, ...p.category.children.map((c) => c.id)] },
      date: { gte: p.periodFrom, lte: p.periodTo },
      ...(p.onlyMine ? { userId: p.userId } : {}),
    },
    _sum: { baseAmount: true },
  });
  return cents(Number(sum._sum.baseAmount ?? 0));
}

const pactSelect = {
  id: true,
  householdId: true,
  userId: true,
  categoryId: true,
  limit: true,
  periodFrom: true,
  periodTo: true,
  onlyMine: true,
  refereeName: true,
  refereeTokenHash: true,
  refereeViews: true,
  refereeLastViewedAt: true,
  promise: true,
  fineAmount: true,
  goalId: true,
  finePaidAt: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
  category: {
    select: { name: true, icon: true, color: true, children: { select: { id: true } } },
  },
  goal: { select: { name: true } },
  household: { select: { currency: true } },
} as const;

/** The space's pacts, newest first, with where each stands today; and what the form needs. */
export async function getPacts(userId: string, householdId: string) {
  const today = todayIso();
  const t = todayInAppTimeZone();
  const lastMonth = utcDate(t.year, t.month - 1, 1);
  const thisMonth = utcDate(t.year, t.month, 1);

  const [pacts, categories, lastMonthSpend, goals, members] = await Promise.all([
    prisma.pact.findMany({
      where: { householdId },
      orderBy: [{ periodTo: "desc" }, { createdAt: "desc" }],
      take: HISTORY,
      select: pactSelect,
    }),
    prisma.category.findMany({
      where: { householdId, type: "EXPENSE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true, children: { select: { id: true } } },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { householdId, type: "EXPENSE", date: { gte: lastMonth, lt: thisMonth } },
      _sum: { baseAmount: true },
    }),
    prisma.goal.findMany({
      where: { householdId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, targetAmount: true, currentAmount: true },
    }),
    prisma.householdMember.count({ where: { householdId } }),
  ]);

  const spentBy = new Map(
    lastMonthSpend.map((s) => [s.categoryId, Number(s._sum.baseAmount ?? 0)]),
  );
  const spent = await Promise.all(pacts.map(pactSpent));
  const items = pacts.map((p, i) => {
    const from = toDateInputValue(p.periodFrom);
    const to = toDateInputValue(p.periodTo);
    const limit = Number(p.limit);
    return {
      id: p.id,
      mine: p.userId === userId,
      author: firstName(p.user),
      category: { name: p.category.name, icon: p.category.icon, color: p.category.color },
      limit,
      from,
      to,
      onlyMine: p.onlyMine,
      spent: spent[i],
      status: pactStatus({ limit, from, to, spent: spent[i], today }),
      referee: p.refereeName
        ? {
            name: p.refereeName,
            linkActive: p.refereeTokenHash !== null && linkExpiry(to) >= today,
            /** A new link still makes sense: up to a month after the end. */
            canRelink: linkExpiry(to) >= today,
            views: p.refereeViews,
            lastViewedOn: p.refereeLastViewedAt ? dayInAppTimeZone(p.refereeLastViewedAt) : null,
          }
        : null,
      promise: p.promise,
      fine:
        p.fineAmount !== null
          ? {
              amount: Number(p.fineAmount),
              goal: p.goal?.name ?? null,
              paidOn: p.finePaidAt ? dayInAppTimeZone(p.finePaidAt) : null,
            }
          : null,
    };
  });

  // Last month in each category, subcategories included in their parent.
  const lastMonthOf = (c: (typeof categories)[number]) =>
    cents([c.id, ...c.children.map((x) => x.id)].reduce((s, id) => s + (spentBy.get(id) ?? 0), 0));
  const parents = new Map(categories.map((c) => [c.id, c.name]));

  return {
    today,
    shared: members > 1,
    pacts: items,
    record: trackRecord(items.filter((p) => p.mine).map((p) => p.status.state)),
    activeMine: items.filter((p) => p.mine && p.to >= today).length,
    // Each category followed by its subcategories: "Trasporti", "Trasporti › Carburante"…
    categories: categories
      .map((c) => ({
        id: c.id,
        name: c.parentId ? `${parents.get(c.parentId) ?? ""} › ${c.name}` : c.name,
        lastMonth: lastMonthOf(c),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "it")),
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      reached: Number(g.currentAmount) >= Number(g.targetAmount),
    })),
  };
}

export type PactsPage = Awaited<ReturnType<typeof getPacts>>;
export type PactItem = PactsPage["pacts"][number];

/**
 * The pact as its referee sees it, through the link: who made it, the limit, how much of it is
 * gone in percent, the stake. Never the movements.
 */
export async function openRefereePact(token: string) {
  if (!isShareToken(token)) return null;
  const pact = await prisma.pact.findUnique({
    where: { refereeTokenHash: hashShareToken(token) },
    select: pactSelect,
  });
  const today = todayIso();
  if (!pact) return null;
  const to = toDateInputValue(pact.periodTo);
  if (linkExpiry(to) < today) return null;
  await prisma.pact.update({
    where: { id: pact.id },
    data: { refereeViews: { increment: 1 }, refereeLastViewedAt: new Date() },
  });
  const limit = Number(pact.limit);
  const from = toDateInputValue(pact.periodFrom);
  const spent = await pactSpent(pact);
  return {
    author: firstName(pact.user),
    referee: pact.refereeName,
    currency: pact.household.currency,
    category: pact.category.name,
    limit,
    from,
    to,
    status: pactStatus({ limit, from, to, spent, today }),
    promise: pact.promise,
    fine:
      pact.fineAmount !== null
        ? { amount: Number(pact.fineAmount), paid: pact.finePaidAt !== null }
        : null,
    expiresOn: linkExpiry(to),
  };
}

/** The user's pacts worth a line in the weekly digest: running, or over in the last week. */
export async function getPactsForDigest(userId: string, householdId: string) {
  const today = todayIso();
  const weekAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 7 * DAY_MS);
  const pacts = await prisma.pact.findMany({
    where: { householdId, userId, periodTo: { gte: weekAgo } },
    orderBy: { periodTo: "asc" },
    select: pactSelect,
  });
  const spent = await Promise.all(pacts.map(pactSpent));
  return pacts.flatMap((p, i) => {
    const from = toDateInputValue(p.periodFrom);
    const to = toDateInputValue(p.periodTo);
    const status = pactStatus({ limit: Number(p.limit), from, to, spent: spent[i], today });
    if (status.state === "upcoming") return [];
    return [
      {
        category: p.category.name,
        limit: Number(p.limit),
        state: status.state,
        used: status.used,
        daysLeft: status.daysLeft,
        finePending: status.state === "lost" && p.fineAmount !== null && p.finePaidAt === null,
      },
    ];
  });
}
