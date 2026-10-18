import { prisma } from "@/lib/db/prisma";
import { hasPro } from "@/lib/billing/plan";
import {
  MIN_MARGINAL_RATE,
  summarizeDeductions,
  type DeductionType,
} from "@/lib/finance/deductions";
import {
  RENT_RULES,
  readTaxProfile,
  rentDeduction,
  type IncomeBand,
  type TaxProfile,
} from "@/lib/finance/rights";
import { distinctPayers, taxAlerts } from "@/lib/tax/alerts";
import { defaultTaxYear, refundTiming, stageOf, timeline, type Payer } from "@/lib/tax/calendar";
import { docProgress, documentsFor, readDocStates } from "@/lib/tax/documents";
import { instalmentsFor } from "@/lib/tax/home-bonus";
import { nextStep, type Channel, type Decision } from "@/lib/tax/next-step";
import { rulesFor } from "@/lib/tax/rules";
import { marginalFromCu, readCu, simulate } from "@/lib/tax/simulate";
import { assess, readSituation, withoutAgent, type Situation } from "@/lib/tax/situation";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

const cents = (n: number) => Math.round(n * 100) / 100;
const RENT = /\baffitto\b|canone di locazione/i;
const SALARY = /stipendio|busta paga|emolumenti|cedolino/i;
/** How a 730 refund usually shows up among the movements. */
const REFUND_WORDS = ["730", "rimborso irpef", "rimborso fiscale", "conguaglio", "credito irpef"];

/** What a deduzione is worth without the CU: the rate of the income band, prudently. */
function bandRate(profile: TaxProfile) {
  return profile.incomeBand === "oltre" ? 0.33 : MIN_MARGINAL_RATE;
}

/** The income band of the rent deduction, from the CU income when it's known. */
function bandFromIncome(income: number): IncomeBand {
  if (income <= RENT_RULES.lowIncome) return "fino-15k";
  return income <= RENT_RULES.midIncome ? "fino-31k" : "oltre";
}

/** Who refunds (or withholds) in July: the employer, the pension, or the Agenzia. */
export function payerOf(s: Situation): Payer {
  if (withoutAgent(s)) return "agency";
  return s.work === "pensioner" ? "pensioner" : "employee";
}

const DECISIONS: readonly Decision[] = ["ACCEPT", "MODIFY", "CAF"];
const CHANNELS: readonly Channel[] = ["SELF", "CAF"];

/**
 * "Il mio 730" for one person and one income year: the answers, the traffic light, the documents,
 * the expenses with their receipts, the alerts, the estimate and the next step. Personal, like the
 * 730: only this person's expenses count (rent is the space's, it's often paid by one for all).
 */
export async function getMy730(userId: string, householdId: string, yearParam?: string) {
  const t = todayInAppTimeZone();
  const today = toDateInputValue(utcDate(t.year, t.month, t.day));
  const [user, household, first] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { taxProfile: true, dependentChildren: true, plan: true, name: true },
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

  const fallback = defaultTaxYear(t);
  const firstYear = Math.min(first?.date.getUTCFullYear() ?? fallback, fallback);
  const years = Array.from({ length: t.year - firstYear + 1 }, (_, i) => firstYear + i);
  const asked = Number(yearParam);
  const year = years.includes(asked) ? asked : fallback;
  const rules = rulesFor(year);

  const range = { gte: utcDate(year, 0, 1), lt: utcDate(year + 1, 0, 1) };
  const [row, own, spaceRent, salaries] = await Promise.all([
    prisma.taxYear.findUnique({ where: { userId_year: { userId, year } } }),
    prisma.transaction.findMany({
      where: { householdId, userId, type: "EXPENSE", date: range },
      select: {
        id: true,
        date: true,
        description: true,
        baseAmount: true,
        deduction: true,
        deductionDoc: true,
        account: { select: { name: true, type: true } },
        category: { select: { name: true, parent: { select: { name: true } } } },
      },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        type: "EXPENSE",
        date: range,
        OR: [
          { category: { name: "Affitto" } },
          { description: { contains: "affitto", mode: "insensitive" } },
          { description: { contains: "canone di locazione", mode: "insensitive" } },
        ],
      },
      select: {
        date: true,
        description: true,
        baseAmount: true,
        category: { select: { name: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { householdId, userId, type: "INCOME", date: range },
      select: { description: true, baseAmount: true, category: { select: { name: true } } },
    }),
  ]);

  const profile = readTaxProfile(user.taxProfile);
  const situation = readSituation(row?.answers);
  const cu = readCu(row?.cu);
  const marginal = marginalFromCu(cu, rules) ?? bandRate(profile);

  const summary = summarizeDeductions(
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
    { marginalRate: marginal },
  );
  const docOf = new Map(own.map((tx) => [tx.id, tx.deductionDoc === "have"]));

  const rentRows = spaceRent.filter(
    (tx) => tx.category?.name === "Affitto" || RENT.test(tx.description),
  );
  const rentPaid = cents(rentRows.reduce((s, tx) => s + Number(tx.baseAmount), 0));
  const rentMonths = new Set(rentRows.map((tx) => toDateInputValue(tx.date).slice(0, 7))).size;
  // With the CU the income is known: no need to ask for the band.
  const cuIncome = cu.entries.reduce((s, e) => s + e.income, 0);
  const rent = rentDeduction({
    year,
    profile: cuIncome > 0 ? { ...profile, incomeBand: bandFromIncome(cuIncome) } : profile,
    rentPaid,
    months: rentMonths,
  });
  const rentAmount = "code" in rent ? rent.amount : 0;

  const payers = distinctPayers(
    salaries
      .filter((tx) => tx.category?.name === "Stipendio" || SALARY.test(tx.description))
      .map((tx) => ({ description: tx.description, amount: Number(tx.baseAmount) })),
  );

  const instalments = instalmentsFor(profile.homeBonuses, year);
  const homeBonusTotal = cents(instalments.reduce((s, i) => s + i.amount, 0));
  const assessment = assess(situation, summary.refund + rentAmount + homeBonusTotal);
  const seen = Array.from(
    new Set(summary.lines.filter((l) => l.type && l.status !== "excluded").map((l) => l.type!)),
  ) as DeductionType[];
  const documents = documentsFor({
    situation,
    seen,
    rent: rentAmount > 0,
    homeBonuses: instalments.length,
    year,
  });
  const docStates = readDocStates(row?.documents);
  const decision = DECISIONS.find((d) => d === row?.decision) ?? null;
  const channel = CHANNELS.find((c) => c === row?.channel) ?? null;
  const sentAt = row?.sentAt ? toDateInputValue(row.sentAt) : null;
  const progress = docProgress(documents, docStates, decision === "CAF" || channel === "CAF");

  const simulation = simulate({
    rules,
    cu,
    situation,
    summary,
    rent: rentAmount,
    homeBonus: homeBonusTotal,
    dependentChildren: user.dependentChildren,
  });
  const stage = stageOf(rules, today, sentAt);
  const payer = payerOf(situation);
  const result = row?.result === null || row?.result === undefined ? null : Number(row.result);
  // A refund still to come: maybe it's already among the movements ("Rimborso 730", "Conguaglio").
  const refundMovement =
    sentAt && result !== null && result > 0 && !row?.refundReceivedAt
      ? await prisma.transaction.findFirst({
          where: {
            householdId,
            userId,
            type: "INCOME",
            date: { gte: new Date(`${sentAt}T00:00:00Z`) },
            OR: REFUND_WORDS.map((w) => ({
              description: { contains: w, mode: "insensitive" as const },
            })),
          },
          orderBy: { date: "asc" },
          select: { date: true, description: true, baseAmount: true },
        })
      : null;
  const pro = hasPro(user);

  return {
    year,
    years,
    today,
    rules,
    stage,
    timeline: timeline(rules),
    pro,
    shared: household._count.members > 1,
    children: user.dependentChildren,
    profile,
    situation,
    assessment,
    documents,
    docStates,
    progress,
    summary: {
      refund: summary.refund,
      lostToCash: summary.lostToCash,
      toCheck: summary.toCheck,
      byType: summary.byType,
    },
    /** One by one, with whether the receipt is in the folder (Pro). */
    lines: pro
      ? summary.lines
          .filter((l) => l.status !== "excluded")
          .map((l) => ({ ...l, hasDoc: docOf.get(l.id) ?? false }))
      : null,
    rent: { paid: rentPaid, months: rentMonths, deduction: rent },
    homeBonuses: profile.homeBonuses,
    instalments,
    alerts: [
      ...taxAlerts({
        year,
        today,
        summary,
        situation,
        payers,
        children: user.dependentChildren,
      }),
      ...(situation.home === "rent" && !profile.rent.contract
        ? [
            {
              key: "rent-contract",
              tone: "info" as const,
              title: "Vivi in affitto: dimmi che contratto hai",
              text: "La detrazione per l'affitto nel precompilato di solito manca. Nel Radar dei diritti bastano tipo di contratto e anno di inizio: la calcolo io e la metto nella stima.",
              href: `/ritrovati/radar?anno=${year}#affitto-title`,
            },
          ]
        : []),
    ],
    cu,
    simulation,
    marginal,
    decision,
    channel,
    sentAt,
    result,
    secondAdvance:
      row?.secondAdvance === null || row?.secondAdvance === undefined
        ? null
        : Number(row.secondAdvance),
    refundReceivedAt: row?.refundReceivedAt ? toDateInputValue(row.refundReceivedAt) : null,
    /** A movement that looks like the refund, to confirm with one tap. */
    refundSeen: refundMovement
      ? {
          date: toDateInputValue(refundMovement.date),
          description: refundMovement.description,
          amount: Number(refundMovement.baseAmount),
        }
      : null,
    shareCapacity: row?.shareCapacity ?? false,
    payer,
    /** When the refund (or the withholding) comes, once the 730 is sent. */
    timing: sentAt ? refundTiming(rules, sentAt, payer) : null,
    next: nextStep({
      stage,
      rules,
      today,
      assessment,
      docs: progress,
      toCheck: summary.toCheck,
      hasCu: cu.entries.length > 0,
      decision,
      channel,
      sentAt,
      result,
      refundReceivedAt: row?.refundReceivedAt ? toDateInputValue(row.refundReceivedAt) : null,
      payer,
    }),
  };
}

export type My730 = Awaited<ReturnType<typeof getMy730>>;
