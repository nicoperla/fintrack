import { prisma } from "@/lib/db/prisma";
import { getWorkSettings } from "@/lib/data/work-time";
import { computeSplit } from "@/lib/finance/split";
import { formatMonthShort, todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

/** Expenses tagged like this stay out of the shared accounts. */
export const PERSONAL_TAG = "personale";

const HISTORY_MONTHS = 6;

/** "Conti chiari": who paid for the shared expenses of the space and who owes whom. */
export async function getSplit(householdId: string) {
  const t = todayInAppTimeZone();
  const monthStart = utcDate(t.year, t.month, 1);
  const historyFrom = utcDate(t.year, t.month - (HISTORY_MONTHS - 1), 1);

  const household = await prisma.household.findUniqueOrThrow({
    where: { id: householdId },
    select: {
      splitMode: true,
      splitSince: true,
      members: {
        orderBy: { joinedAt: "asc" },
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  const since = household.splitSince ?? monthStart;
  const shared = { householdId, type: "EXPENSE" as const, NOT: { tags: { has: PERSONAL_TAG } } };

  const [paid, settlements, history, recent, works] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["userId"],
      where: { ...shared, date: { gte: since } },
      _sum: { baseAmount: true },
    }),
    prisma.settlement.findMany({
      where: { householdId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { id: true, fromUserId: true, toUserId: true, amount: true, date: true },
    }),
    prisma.$queryRaw<{ month: Date; user_id: string | null; total: unknown }[]>`
      SELECT date_trunc('month', "date") AS month, "user_id", SUM("base_amount") AS total
      FROM "transactions"
      WHERE "household_id" = ${householdId} AND "type"::text = 'EXPENSE'
        AND NOT (${PERSONAL_TAG} = ANY("tags")) AND "date" >= ${historyFrom}::date
      GROUP BY 1, 2`,
    prisma.transaction.findMany({
      where: { householdId, type: "EXPENSE", date: { gte: since } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        date: true,
        description: true,
        baseAmount: true,
        userId: true,
        tags: true,
        category: { select: { name: true, icon: true, color: true } },
      },
    }),
    Promise.all(household.members.map((m) => getWorkSettings(m.user.id, householdId))),
  ]);

  const members = household.members.map((m, i) => ({
    userId: m.user.id,
    name: m.user.name?.split(" ")[0] || m.user.email.split("@")[0],
    // The net income each member set, or what they recorded in this space.
    income: works[i].manualIncome ?? works[i].estimatedIncome,
  }));
  const names = new Map(members.map((m) => [m.userId, m.name]));
  const sinceIso = toDateInputValue(since);

  const result = computeSplit({
    members,
    expenses: paid.map((p) => ({ userId: p.userId, amount: Number(p._sum.baseAmount ?? 0) })),
    settlements: settlements
      .filter((s) => toDateInputValue(s.date) >= sinceIso)
      .map((s) => ({ fromUserId: s.fromUserId, toUserId: s.toUserId, amount: Number(s.amount) })),
    mode: household.splitMode,
  });

  const months = Array.from({ length: HISTORY_MONTHS }, (_, i) => {
    const date = utcDate(t.year, t.month - (HISTORY_MONTHS - 1) + i, 1);
    const key = toDateInputValue(date).slice(0, 7);
    const row: Record<string, string | number> = { month: formatMonthShort(date) };
    for (const m of members) {
      row[m.userId] = history
        .filter((h) => toDateInputValue(h.month).slice(0, 7) === key && h.user_id === m.userId)
        .reduce((s, h) => s + Number(h.total), 0);
    }
    return row;
  });

  return {
    // The rule chosen; `mode` (from the result) is the one applied.
    setting: household.splitMode,
    since: sinceIso,
    sinceIsDefault: household.splitSince === null,
    ...result,
    months,
    recent: recent.map((r) => ({
      id: r.id,
      date: toDateInputValue(r.date),
      description: r.description,
      amount: Number(r.baseAmount),
      paidBy: r.userId ? (names.get(r.userId) ?? "Ex membro") : "Ex membro",
      personal: r.tags.includes(PERSONAL_TAG),
      category: r.category,
    })),
    settlements: settlements.slice(0, 10).map((s) => ({
      id: s.id,
      from: names.get(s.fromUserId) ?? "Ex membro",
      to: names.get(s.toUserId) ?? "Ex membro",
      amount: Number(s.amount),
      date: toDateInputValue(s.date),
      counted: toDateInputValue(s.date) >= sinceIso,
    })),
  };
}

export type SplitData = Awaited<ReturnType<typeof getSplit>>;
