import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { toDateInputValue } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GDPR data portability: the profile and every space the user belongs to, as one JSON file.
 * Other members appear by name only (their email is their data, not the user's).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  const userId = session.user.id;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      createdAt: true,
      emailVerifiedAt: true,
      termsAcceptedAt: true,
      aiConsentAt: true,
      weeklyDigest: true,
      monthlyNetIncome: true,
      workHoursPerWeek: true,
      showWorkTime: true,
      coachProfile: true,
      plan: true,
      subscriptionStatus: true,
      planRenewsAt: true,
      memberships: { select: { role: true, joinedAt: true, householdId: true } },
    },
  });

  const spaces = await Promise.all(
    user.memberships.map(async (membership) => {
      const id = membership.householdId;
      const [household, accounts, categories, transactions, budgets, goals, debts, settlements] =
        await Promise.all([
          prisma.household.findUniqueOrThrow({
            where: { id },
            select: {
              name: true,
              currency: true,
              splitMode: true,
              splitSince: true,
              createdAt: true,
              members: {
                select: { role: true, user: { select: { id: true, name: true } } },
              },
            },
          }),
          prisma.financialAccount.findMany({
            where: { householdId: id },
            orderBy: { createdAt: "asc" },
          }),
          prisma.category.findMany({ where: { householdId: id }, orderBy: { name: "asc" } }),
          prisma.transaction.findMany({
            where: { householdId: id },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
            include: {
              account: { select: { name: true } },
              transferAccount: { select: { name: true } },
              category: { select: { name: true } },
            },
          }),
          prisma.budget.findMany({
            where: { householdId: id },
            include: { category: { select: { name: true } } },
          }),
          prisma.goal.findMany({ where: { householdId: id } }),
          prisma.debt.findMany({ where: { householdId: id } }),
          prisma.settlement.findMany({ where: { householdId: id }, orderBy: { date: "asc" } }),
        ]);
      const names = new Map(household.members.map((m) => [m.user.id, m.user.name ?? "Membro"]));
      const who = (authorId: string | null) =>
        authorId === userId ? "tu" : authorId ? (names.get(authorId) ?? "ex membro") : "ex membro";

      return {
        name: household.name,
        currency: household.currency,
        yourRole: membership.role,
        joinedAt: membership.joinedAt,
        members: household.members.map((m) => ({
          name: m.user.id === userId ? "tu" : (m.user.name ?? "Membro"),
          role: m.role,
        })),
        sharedExpenses: { mode: household.splitMode, since: household.splitSince },
        accounts: accounts.map((a) => ({
          name: a.name,
          type: a.type,
          currency: a.currency,
          initialBalance: a.initialBalance,
          archived: a.archived,
          createdBy: who(a.userId),
        })),
        categories: categories.map((c) => ({
          name: c.name,
          type: c.type,
          parent: categories.find((p) => p.id === c.parentId)?.name ?? null,
        })),
        transactions: transactions.map((t) => ({
          date: toDateInputValue(t.date),
          type: t.type,
          amount: t.amount,
          amountInSpaceCurrency: t.baseAmount,
          account: t.account.name,
          toAccount: t.transferAccount?.name ?? null,
          transferAmount: t.transferAmount,
          category: t.category?.name ?? null,
          description: t.description,
          notes: t.notes,
          tags: t.tags,
          recordedBy: who(t.userId),
          recordedAt: t.createdAt,
        })),
        budgets: budgets.map((b) => ({
          category: b.category.name,
          amount: b.amount,
          alertThreshold: b.alertThreshold,
        })),
        goals: goals.map((g) => ({
          name: g.name,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          targetDate: g.targetDate ? toDateInputValue(g.targetDate) : null,
        })),
        debts: debts.map((d) => ({
          name: d.name,
          balance: d.balance,
          interestRate: d.interestRate,
          minimumPayment: d.minimumPayment,
        })),
        settlements: settlements.map((s) => ({
          date: toDateInputValue(s.date),
          from: who(s.fromUserId),
          to: who(s.toUserId),
          amount: s.amount,
        })),
      };
    }),
  );

  const { memberships, ...profile } = user;
  void memberships;
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), format: "fintrack-export-v1", profile, spaces },
    null,
    2,
  );
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fintrack-dati-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
