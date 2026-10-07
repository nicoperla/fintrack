import { cache } from "react";
import type { ClaimKind, ClaimStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { FREE_OPEN_CLAIMS, hasPro } from "@/lib/billing/plan";
import { getRecurring } from "@/lib/data/intelligence";
import {
  CLAIM_KINDS,
  addDays,
  cancelledService,
  chargesAfterCancellation,
  formatClaimDate,
  isOpenClaim,
  merchantName,
  nextStep,
  parseFindingKey,
  suggestedKind,
  summarizeClaims,
} from "@/lib/finance/claims";
import { looksLikeBankFee } from "@/lib/finance/found-money";
import { normalizeDescription } from "@/lib/finance/recurring";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

const DAY_MS = 86_400_000;
// A charge after the mandate was revoked can be disowned for 13 months: look that far back.
const AFTER_CANCELLATION_LOOKBACK_DAYS = 400;
const cents = (n: number) => Math.round(n * 100) / 100;

function todayIso() {
  const t = todayInAppTimeZone();
  return toDateInputValue(utcDate(t.year, t.month, t.day));
}
const iso = (date: Date | null) => (date ? toDateInputValue(date) : null);
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const daysAgo = (day: string, days: number) =>
  toDateInputValue(new Date(asDate(day).getTime() - days * DAY_MS));
const inItaly = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" });

const claimSelect = {
  id: true,
  kind: true,
  status: true,
  findingKey: true,
  counterparty: true,
  expectedAmount: true,
  recoveredAmount: true,
  subject: true,
  body: true,
  channel: true,
  sentAt: true,
  effectiveFrom: true,
  deadline: true,
  closedAt: true,
  notes: true,
  createdAt: true,
  userId: true,
  transaction: {
    select: {
      id: true,
      date: true,
      description: true,
      baseAmount: true,
      account: { select: { name: true } },
      category: { select: { name: true } },
    },
  },
} satisfies Prisma.ClaimSelect;

function toClaimView(row: Prisma.ClaimGetPayload<{ select: typeof claimSelect }>) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    findingKey: row.findingKey,
    counterparty: row.counterparty,
    expectedAmount: Number(row.expectedAmount),
    recoveredAmount: row.recoveredAmount === null ? null : Number(row.recoveredAmount),
    subject: row.subject,
    body: row.body,
    channel: row.channel,
    sentAt: iso(row.sentAt),
    effectiveFrom: iso(row.effectiveFrom),
    deadline: iso(row.deadline),
    closedAt: row.closedAt ? inItaly.format(row.closedAt) : null,
    notes: row.notes,
    /** The day it was opened, in Italy. */
    openedOn: inItaly.format(row.createdAt),
    openedBy: row.userId,
    transaction: row.transaction
      ? {
          id: row.transaction.id,
          date: toDateInputValue(row.transaction.date),
          description: row.transaction.description,
          amount: Number(row.transaction.baseAmount),
          account: row.transaction.account.name,
          category: row.transaction.category?.name ?? null,
        }
      : null,
  };
}

export type ClaimView = ReturnType<typeof toClaimView>;

/** Charges of cancelled services that arrived anyway (see chargesAfterCancellation). */
async function findChargesAfter(householdId: string, claims: ClaimView[], today: string) {
  const cancellations = claims.filter(
    (c) =>
      c.kind === "CANCELLATION" &&
      c.effectiveFrom &&
      (c.status === "SENT" || c.status === "WON" || c.status === "PARTIAL"),
  );
  if (cancellations.length === 0) return [];
  const earliest = cancellations.reduce(
    (min, c) => (c.effectiveFrom! < min ? c.effectiveFrom! : min),
    today,
  );
  const floor = daysAgo(today, AFTER_CANCELLATION_LOOKBACK_DAYS);
  const expenses = await prisma.transaction.findMany({
    where: {
      householdId,
      type: "EXPENSE",
      date: { gte: asDate(earliest > floor ? earliest : floor) },
    },
    select: { id: true, date: true, description: true, baseAmount: true },
  });
  const contested = new Set(claims.flatMap((c) => (c.transaction ? [c.transaction.id] : [])));
  return chargesAfterCancellation(
    cancellations.map((c) => ({
      id: c.id,
      kind: c.kind,
      status: c.status,
      findingKey: c.findingKey,
      counterparty: c.counterparty,
      effectiveFrom: c.effectiveFrom,
      chargeDescription: c.transaction?.description ?? null,
    })),
    expenses.map((t) => ({
      id: t.id,
      date: toDateInputValue(t.date),
      description: t.description,
      amount: Number(t.baseAmount),
    })),
    contested,
  );
}

/** Every claim of the space with its next step, the totals and what to claim next. */
export const getClaimsOverview = cache(async (userId: string, householdId: string) => {
  const today = todayIso();
  const [user, rows] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } }),
    prisma.claim.findMany({
      where: { householdId },
      select: claimSelect,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const claims = rows.map(toClaimView);
  const suggestions = await findChargesAfter(householdId, claims, today);
  const afterCount = new Map<string, number>();
  for (const s of suggestions) afterCount.set(s.claimId, (afterCount.get(s.claimId) ?? 0) + 1);

  const withSteps = claims.map((c) => ({
    ...c,
    step: nextStep(c, today, afterCount.get(c.id) ?? 0),
  }));
  const totals = summarizeClaims(
    withSteps.map((c) => ({
      kind: c.kind,
      status: c.status,
      recoveredAmount: c.recoveredAmount,
      urgent: c.step.tone === "urgent",
    })),
  );
  const pro = hasPro(user);
  return {
    today,
    claims: withSteps,
    /** Charges after a cancellation: each one is a direct debit refund to ask for. */
    suggestions,
    totals,
    pro,
    /** The free plan follows one claim at a time. */
    canOpen: pro || totals.open < FREE_OPEN_CLAIMS,
  };
});

export type ClaimsOverview = Awaited<ReturnType<typeof getClaimsOverview>>;
export type ClaimWithStep = ClaimsOverview["claims"][number];

export async function getClaim(userId: string, householdId: string, id: string) {
  const overview = await getClaimsOverview(userId, householdId);
  const claim = overview.claims.find((c) => c.id === id);
  if (!claim) return null;
  return {
    claim,
    chargesAfter: overview.suggestions.filter((s) => s.claimId === id),
    today: overview.today,
    pro: overview.pro,
  };
}

export type ClaimMark = { id: string; status: ClaimStatus };

/** Which findings and charges already have a claim: "Soldi ritrovati" shows them as such. */
export function claimMarks(claims: ClaimView[]) {
  const byFinding: Record<string, ClaimMark> = {};
  const byTransaction: Record<string, ClaimMark> = {};
  // Claims come newest first: going oldest first, a charge contested twice shows its latest claim.
  for (const c of [...claims].reverse()) {
    const mark = { id: c.id, status: c.status };
    if (c.findingKey) byFinding[c.findingKey] = mark;
    if (c.transaction) byTransaction[c.transaction.id] = mark;
  }
  return { byFinding, byTransaction };
}

export type ClaimMarks = ReturnType<typeof claimMarks>;

type Expense = {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  category: string | null;
};

async function loadExpense(householdId: string, id: string): Promise<Expense | null> {
  const tx = await prisma.transaction.findFirst({
    where: { id, householdId, type: "EXPENSE" },
    select: {
      id: true,
      date: true,
      description: true,
      baseAmount: true,
      account: { select: { name: true } },
      category: { select: { name: true } },
    },
  });
  return tx
    ? {
        id: tx.id,
        date: toDateInputValue(tx.date),
        description: tx.description,
        amount: Number(tx.baseAmount),
        account: tx.account.name,
        category: tx.category?.name ?? null,
      }
    : null;
}

/** The bank's own charges of the last twelve months, and the account they hit most. */
async function recentBankFees(householdId: string, today: string) {
  const rows = await prisma.transaction.findMany({
    where: { householdId, type: "EXPENSE", date: { gte: asDate(daysAgo(today, 365)) } },
    select: {
      description: true,
      baseAmount: true,
      account: { select: { name: true } },
      category: { select: { name: true } },
    },
  });
  const fees = rows.filter((r) => looksLikeBankFee(r.description, r.category?.name ?? null));
  if (fees.length === 0) return null;
  const byAccount = new Map<string, number>();
  for (const f of fees) byAccount.set(f.account.name, (byAccount.get(f.account.name) ?? 0) + 1);
  return {
    total: cents(fees.reduce((sum, f) => sum + Number(f.baseAmount), 0)),
    account: Array.from(byAccount).sort((a, b) => b[1] - a[1])[0][0],
  };
}

export type ClaimPrefill = {
  kind: ClaimKind;
  counterparty: string;
  amount: number | null;
  chargeDate: string | null;
  effectiveFrom: string | null;
  findingKey: string | null;
  transaction: Expense | null;
  /** Where the claim comes from, for the page's subtitle (no amounts: discreet mode). */
  source: string | null;
};

/**
 * The new-claim form, filled in from a "Soldi ritrovati" finding or a contested charge. Null when
 * the finding or the charge isn't there (anymore); `existingId` when the finding has a claim.
 */
export async function getClaimPrefill(
  householdId: string,
  params: { ritrovato?: string; movimento?: string; tipo?: string },
): Promise<ClaimPrefill | { existingId: string } | null> {
  const kindParam = CLAIM_KINDS.find((k) => k === params.tipo) ?? null;

  if (params.ritrovato) {
    const key = params.ritrovato;
    const ref = parseFindingKey(key);
    if (!ref) return null;
    const existing = await prisma.claim.findUnique({
      where: { householdId_findingKey: { householdId, findingKey: key } },
      select: { id: true },
    });
    if (existing) return { existingId: existing.id };

    switch (ref.type) {
      case "duplicate": {
        const tx = await loadExpense(householdId, ref.transactionId);
        if (!tx) return null;
        return {
          kind: "DUPLICATE_CHARGE",
          counterparty: merchantName(tx.description),
          amount: tx.amount,
          chargeDate: tx.date,
          effectiveFrom: null,
          findingKey: key,
          transaction: tx,
          source: `Dal doppio addebito del ${formatClaimDate(tx.date)}.`,
        };
      }
      case "subscription": {
        const subscription = (await getRecurring(householdId)).find(
          (r) => r.key === ref.recurringKey && r.type === "EXPENSE",
        );
        if (!subscription) return null;
        return {
          kind: "CANCELLATION",
          counterparty: merchantName(subscription.name),
          amount: cents(subscription.monthlyCost * 12),
          chargeDate: null,
          effectiveFrom: null,
          findingKey: key,
          transaction: null,
          source:
            "Da un abbonamento trovato tra i tuoi movimenti: l'importo è quanto costa in un anno.",
        };
      }
      case "fees": {
        const fees = await recentBankFees(householdId, todayIso());
        if (!fees) return null;
        return {
          kind: "BANK_COMPLAINT",
          counterparty: fees.account,
          amount: fees.total,
          chargeDate: null,
          effectiveFrom: null,
          findingKey: key,
          transaction: null,
          source: "Dalle commissioni bancarie degli ultimi 12 mesi.",
        };
      }
      case "after": {
        const tx = await loadExpense(householdId, ref.transactionId);
        if (!tx) return null;
        const cancellations = await prisma.claim.findMany({
          where: {
            householdId,
            kind: "CANCELLATION",
            status: { in: ["SENT", "WON", "PARTIAL"] },
            effectiveFrom: { lte: asDate(tx.date) },
          },
          select: {
            counterparty: true,
            findingKey: true,
            effectiveFrom: true,
            transaction: { select: { description: true } },
          },
        });
        const service = normalizeDescription(tx.description);
        const cancellation = cancellations.find(
          (c) =>
            cancelledService({
              findingKey: c.findingKey,
              counterparty: c.counterparty,
              chargeDescription: c.transaction?.description ?? null,
            }) === service,
        );
        if (!cancellation) return null;
        return {
          kind: "DIRECT_DEBIT_REFUND",
          counterparty: cancellation.counterparty,
          amount: tx.amount,
          chargeDate: tx.date,
          effectiveFrom: iso(cancellation.effectiveFrom),
          findingKey: key,
          transaction: tx,
          source: `Dall'addebito arrivato dopo la disdetta di ${cancellation.counterparty}.`,
        };
      }
    }
  }

  if (params.movimento) {
    const tx = await loadExpense(householdId, params.movimento);
    if (!tx) return null;
    return {
      kind: kindParam ?? suggestedKind(tx.description, tx.category),
      counterparty: merchantName(tx.description),
      amount: tx.amount,
      chargeDate: tx.date,
      effectiveFrom: null,
      findingKey: null,
      transaction: tx,
      source: "Dal movimento che vuoi contestare.",
    };
  }

  return {
    kind: kindParam ?? "CANCELLATION",
    counterparty: "",
    amount: null,
    chargeDate: null,
    effectiveFrom: null,
    findingKey: null,
    transaction: null,
    source: null,
  };
}

/** Open claims that need attention soon, for the weekly digest. */
export function claimsToMention(claims: ClaimWithStep[], today: string) {
  const soon = addDays(today, 14);
  return claims
    .filter((c) => isOpenClaim(c.status))
    .filter((c) => c.step.tone === "urgent" || (c.deadline !== null && c.deadline <= soon))
    .slice(0, 5);
}
