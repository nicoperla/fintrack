import { prisma } from "@/lib/db/prisma";
import { readTaxProfile } from "@/lib/finance/rights";
import { readSituation } from "@/lib/tax/situation";
import { accountFigures, iseeBaseYear, iseeCalendar, type IseeAccount } from "@/lib/tax/isee";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

/**
 * "ISEE e bonus": the ISEE of this year and the next, the balances and average balances of the
 * space's accounts for the years they're based on, and what Orbitly knows to suggest bonuses.
 */
export async function getIsee(userId: string, householdId: string) {
  const t = todayInAppTimeZone();
  const today = toDateInputValue(utcDate(t.year, t.month, t.day));
  // From November the next ISEE is the one to prepare.
  const iseeYear = t.month >= 10 ? t.year + 1 : t.year;
  const baseYear = iseeBaseYear(iseeYear);

  const [user, accounts, firstMoves, taxYear] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { taxProfile: true, dependentChildren: true },
    }),
    prisma.financialAccount.findMany({
      where: { householdId },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
        initialBalance: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { householdId },
      _min: { date: true },
    }),
    prisma.taxYear.findUnique({
      where: { userId_year: { userId, year: t.year - 1 } },
      select: { answers: true },
    }),
  ]);
  const movements = await prisma.transaction.findMany({
    where: { householdId, date: { lt: utcDate(t.year + 1, 0, 1) } },
    select: {
      date: true,
      type: true,
      accountId: true,
      transferAccountId: true,
      amount: true,
      transferAmount: true,
    },
  });

  const firstMove = new Map(firstMoves.map((m) => [m.accountId, m._min.date]));
  const iseeAccounts: IseeAccount[] = accounts.map((a) => {
    const created = toDateInputValue(a.createdAt);
    const moved = firstMove.get(a.id);
    const first = moved ? toDateInputValue(moved) : created;
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      initialBalance: Number(a.initialBalance),
      startsOn: first < created ? first : created,
    };
  });
  const moves = movements.map((m) => ({
    date: toDateInputValue(m.date),
    type: m.type,
    accountId: m.accountId,
    transferAccountId: m.transferAccountId,
    amount: Number(m.amount),
    transferAmount: m.transferAmount === null ? null : Number(m.transferAmount),
  }));
  const firstData = iseeAccounts.reduce<string | null>(
    (min, a) => (min === null || a.startsOn < min ? a.startsOn : min),
    null,
  );
  const figures = (year: number) =>
    firstData !== null && firstData <= `${year}-12-31`
      ? accountFigures(iseeAccounts, moves, year, year === t.year ? today : undefined)
      : null;

  const profile = readTaxProfile(user.taxProfile);
  const situation = readSituation(taxYear?.answers);
  return {
    today,
    iseeYear,
    calendar: iseeCalendar(iseeYear),
    baseYear,
    /**
     * The figures of every year from the one this ISEE uses to today: the later ones are the
     * ISEE of the next years taking shape (this year's is complete only after December).
     */
    years: Array.from({ length: t.year - baseYear + 1 }, (_, i) => baseYear + i)
      .map((year) => ({
        year,
        iseeYear: year + 2,
        accounts: figures(year),
        partial: firstData !== null && firstData > `${year}-01-01`,
        ongoing: year === t.year,
      }))
      .filter((y) => y.accounts !== null && y.accounts.length > 0),
    isee: profile.isee,
    hints: {
      rent: profile.rent.contract !== null || situation.home === "rent",
      newborn: situation.events.includes("child"),
      age: profile.birthYear ? t.year - profile.birthYear : null,
      children: user.dependentChildren,
      workless: situation.work === "none",
    },
  };
}

export type IseeData = Awaited<ReturnType<typeof getIsee>>;
