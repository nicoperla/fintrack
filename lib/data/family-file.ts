import { prisma } from "@/lib/db/prisma";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { getInvestments } from "@/lib/data/investments";
import { getRecurring } from "@/lib/data/intelligence";
import {
  buildFamilyFile,
  isShareToken,
  readNotes,
  shareState,
  type FamilyFileInput,
} from "@/lib/family-file";
import { hashShareToken } from "@/lib/family-file-tokens";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

/** What the family file of a space is made of, before choosing whether to show amounts. */
export async function getFamilyFileInput(householdId: string): Promise<FamilyFileInput> {
  const t = todayInAppTimeZone();
  const [household, accounts, investments, debts, recurring, file] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: {
        name: true,
        currency: true,
        members: {
          orderBy: { joinedAt: "asc" },
          select: { user: { select: { name: true, email: true } } },
        },
      },
    }),
    getAccountsWithBalances(householdId),
    getInvestments(householdId),
    prisma.debt.findMany({ where: { householdId }, orderBy: { balance: "desc" } }),
    getRecurring(householdId),
    prisma.familyFile.findUnique({ where: { householdId }, select: { notes: true } }),
  ]);

  return {
    spaceName: household.name,
    currency: household.currency,
    today: toDateInputValue(utcDate(t.year, t.month, t.day)),
    people: household.members.map((m) => m.user.name || m.user.email.split("@")[0]),
    accounts: accounts.map((a) => ({
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: a.balance.toNumber(),
      archived: a.archived,
    })),
    investments: investments.accounts.map((i) => ({
      name: i.name,
      currency: i.currency,
      value: i.value,
      valuedAt: i.valuedAt,
    })),
    debts: debts.map((d) => ({
      name: d.name,
      balance: d.balance.toNumber(),
      interestRate: d.interestRate.toNumber(),
      minimumPayment: d.minimumPayment.toNumber(),
    })),
    // What someone would have to cancel or take over: the regular outgoing payments.
    recurring: recurring
      .filter((r) => r.active && r.type === "EXPENSE")
      .slice(0, 20)
      .map((r) => ({
        name: r.name,
        frequency: r.frequency,
        amount: r.averageAmount,
        nextDate: r.nextDate,
      })),
    notes: readNotes(file?.notes),
  };
}

/** The links of a space that still work, for the owner's page (never their tokens). */
export async function getFamilyShares(householdId: string) {
  const now = new Date();
  const shares = await prisma.familyFileShare.findMany({
    where: { householdId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      showAmounts: true,
      expiresAt: true,
      views: true,
      lastViewedAt: true,
    },
  });
  return shares.map((s) => ({
    id: s.id,
    label: s.label,
    showAmounts: s.showAmounts,
    expiresAt: s.expiresAt.toISOString(),
    views: s.views,
    lastViewedAt: s.lastViewedAt?.toISOString() ?? null,
  }));
}

export type FamilyShare = Awaited<ReturnType<typeof getFamilyShares>>[number];

/**
 * The family file behind a shared link, or null: unknown, expired or revoked links all look
 * the same from outside. Every opening is counted, so the owner sees it was used.
 */
export async function openSharedFamilyFile(token: string) {
  if (!isShareToken(token)) return null;
  const share = await prisma.familyFileShare.findUnique({
    where: { tokenHash: hashShareToken(token) },
    select: {
      id: true,
      householdId: true,
      label: true,
      showAmounts: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  if (!share || shareState(share, new Date()) !== "active") return null;
  await prisma.familyFileShare.update({
    where: { id: share.id },
    data: { views: { increment: 1 }, lastViewedAt: new Date() },
  });
  const input = await getFamilyFileInput(share.householdId);
  return {
    content: buildFamilyFile(input, { showAmounts: share.showAmounts }),
    label: share.label,
    expiresAt: share.expiresAt.toISOString(),
  };
}
