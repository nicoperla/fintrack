import { prisma } from "@/lib/db/prisma";
import {
  accountCosts,
  compareBankAccount,
  compareCar,
  compareElectricity,
  MIN_MONTHS_FOR_FEES,
  upcomingRenewals,
  type TariffKind,
} from "@/lib/finance/tariffs";
import {
  AGE_BANDS,
  BANK_ACCOUNT_KINDS,
  type AgeBand,
  type BankAccountKind,
} from "@/lib/finance/tariff-data";
import { dayInAppTimeZone, todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

const cents = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date | null) => (d ? toDateInputValue(d) : null);
const num = (d: { toNumber(): number } | null) => (d === null ? null : d.toNumber());
const isAgeBand = (v: string | null): v is AgeBand => AGE_BANDS.includes(v as AgeBand);
const isAccountKind = (v: string | null): v is BankAccountKind =>
  BANK_ACCOUNT_KINDS.includes(v as BankAccountKind);

/**
 * "Il Tariffometro" for a space: its RC auto policies, current accounts and light bills, each
 * against the public prices. The public prices are in euro: in a space with another currency
 * the figures are shown without a comparison.
 */
export async function getTariffometro(householdId: string) {
  const t = todayInAppTimeZone();
  const todayDate = utcDate(t.year, t.month, t.day);
  const today = toDateInputValue(todayDate);

  const [household, checks, allAccounts] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { currency: true, province: true, householdSize: true, tariffPoolSince: true },
    }),
    prisma.tariffCheck.findMany({ where: { householdId }, orderBy: { createdAt: "asc" } }),
    prisma.financialAccount.findMany({
      where: { householdId, type: "CHECKING", archived: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, currency: true },
    }),
  ]);
  // A dollar account in a euro space isn't what the Italian survey measures.
  const accounts = allAccounts.filter((a) => a.currency === household.currency);
  const accountIds = accounts.map((a) => a.id);
  const [movements, firsts] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        householdId,
        accountId: { in: accountIds },
        type: "EXPENSE",
        // From the start of the month a year ago: fees count whole months.
        date: { gte: utcDate(t.year, t.month - 12, 1), lte: todayDate },
      },
      select: {
        accountId: true,
        date: true,
        description: true,
        baseAmount: true,
        category: { select: { name: true } },
      },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { householdId, accountId: { in: accountIds } },
      _min: { date: true },
    }),
  ]);

  const euro = household.currency === "EUR";

  const cars = checks
    .filter((c) => c.kind === "CAR_INSURANCE" && c.amount !== null)
    .map((c) => {
      const premium = c.amount!.toNumber();
      const previous = num(c.previousAmount);
      const ageBand = isAgeBand(c.ageBand) ? c.ageBand : null;
      return {
        id: c.id,
        label: c.label,
        premium,
        previous,
        /** Paid less than the previous policy year. */
        saved: previous !== null && previous > premium ? cents(previous - premium) : 0,
        renewsOn: iso(c.renewsOn),
        bonusMalus: c.bonusMalus,
        ageBand,
        comparison: euro
          ? compareCar({
              premium,
              province: household.province,
              bonusMalus: c.bonusMalus,
              ageBand,
            })
          : null,
      };
    });

  const bankAccounts = accounts.map((account) => {
    const check = checks.find((c) => c.kind === "BANK_ACCOUNT" && c.accountId === account.id);
    const first = firsts.find((f) => f.accountId === account.id)?._min.date ?? null;
    const costs = accountCosts(
      movements
        .filter((m) => m.accountId === account.id)
        .map((m) => ({
          date: toDateInputValue(m.date),
          description: m.description,
          amount: m.baseAmount.toNumber(),
          category: m.category?.name ?? null,
        })),
      today,
      iso(first),
    );
    const typed = num(check?.amount ?? null);
    const storedKind = check?.accountKind ?? null;
    const kind = isAccountKind(storedKind) ? storedKind : null;
    // Without fees among the movements nothing says the account is free: maybe they aren't
    // recorded. Then only the figure from the bank's statement counts; the same with too short
    // a history.
    const enough = costs.months >= MIN_MONTHS_FOR_FEES;
    const yearly = typed ?? (enough && costs.count > 0 ? costs.yearly : null);
    return {
      accountId: account.id,
      name: account.name,
      kind,
      typed,
      costs,
      /** Too few complete months of movements to tell what a year costs. */
      tooRecent: !enough,
      yearly,
      source:
        typed !== null ? ("statement" as const) : yearly !== null ? ("movements" as const) : null,
      comparison: euro && kind && yearly !== null ? compareBankAccount(yearly, kind) : null,
    };
  });

  const bills = checks
    .filter(
      (c) =>
        c.kind === "ELECTRICITY" &&
        c.amount !== null &&
        c.kwh !== null &&
        c.periodFrom !== null &&
        c.periodTo !== null,
    )
    .map((c) => {
      const bill = {
        amount: c.amount!.toNumber(),
        kwh: c.kwh!,
        from: iso(c.periodFrom)!,
        to: iso(c.periodTo)!,
      };
      return {
        id: c.id,
        label: c.label,
        ...bill,
        renewsOn: iso(c.renewsOn),
        comparison: euro ? compareElectricity(bill) : null,
      };
    });

  const above = [
    ...cars.flatMap((c) =>
      c.comparison?.verdict === "above"
        ? [{ kind: "CAR_INSURANCE" as TariffKind, label: c.label, over: c.comparison.over }]
        : [],
    ),
    ...bankAccounts.flatMap((a) =>
      a.comparison?.verdict === "above"
        ? [{ kind: "BANK_ACCOUNT" as TariffKind, label: a.name, over: a.comparison.over }]
        : [],
    ),
    ...bills.flatMap((b) =>
      b.comparison?.verdict === "above"
        ? [{ kind: "ELECTRICITY" as TariffKind, label: b.label, over: b.comparison.over }]
        : [],
    ),
  ];

  return {
    today,
    euro,
    currency: household.currency,
    profile: {
      province: household.province,
      householdSize: household.householdSize,
      /** The day the space joined the comparison between users, in Italy. */
      poolSince: household.tariffPoolSince ? dayInAppTimeZone(household.tariffPoolSince) : null,
    },
    cars,
    bankAccounts,
    bills,
    summary: {
      compared: [...cars, ...bankAccounts, ...bills].filter((x) => x.comparison !== null).length,
      above,
      overPerYear: cents(above.reduce((s, a) => s + a.over, 0)),
    },
    renewals: upcomingRenewals(
      [
        ...cars.map((c) => ({ ...c, kind: "CAR_INSURANCE" as const })),
        ...bills.map((b) => ({ ...b, kind: "ELECTRICITY" as const })),
      ],
      today,
    ),
  };
}

export type Tariffometro = Awaited<ReturnType<typeof getTariffometro>>;

/** RC auto policies and fixed light prices ending within a month, for the weekly digest. */
export async function getTariffRenewals(householdId: string, today: string) {
  const checks = await prisma.tariffCheck.findMany({
    where: {
      householdId,
      kind: { in: ["CAR_INSURANCE", "ELECTRICITY"] },
      renewsOn: { gte: new Date(`${today}T00:00:00Z`) },
    },
    select: { id: true, kind: true, label: true, renewsOn: true },
  });
  return upcomingRenewals(
    checks.map((c) => ({ ...c, renewsOn: iso(c.renewsOn) })),
    today,
  );
}
