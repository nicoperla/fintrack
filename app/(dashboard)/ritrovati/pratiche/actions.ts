"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { FREE_OPEN_CLAIMS, hasPro } from "@/lib/billing/plan";
import { claimLetter } from "@/lib/claims/letters";
import { answerDeadline, draftDeadline, isOpenClaim } from "@/lib/finance/claims";
import { looksLikeBankFee } from "@/lib/finance/found-money";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";
import {
  letterSchema,
  markSentSchema,
  openClaimSchema,
  outcomeSchema,
} from "@/lib/validations/claims";
import { validationError, type ActionResult } from "@/lib/action-result";

/*
 * "Riprenditeli" claims. Every query is scoped to the active space, so nobody can read or change
 * someone else's claims by guessing an id. FinTrack never sends anything: the user does.
 */

const NOT_FOUND: ActionResult = { ok: false, error: "Pratica non trovata." };
const FREE_LIMIT: ActionResult = {
  ok: false,
  error: "Con il piano gratuito segui una pratica alla volta: chiudi quella aperta o passa a Pro.",
};

const idSchema = z.string().min(1).max(40);
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

function today() {
  const t = todayInAppTimeZone();
  return toDateInputValue(utcDate(t.year, t.month, t.day));
}

function revalidate(id?: string) {
  revalidatePath("/ritrovati/pratiche");
  if (id) revalidatePath(`/ritrovati/pratiche/${id}`);
  revalidatePath("/ritrovati");
  revalidatePath("/dashboard");
}

/** The free plan follows one open claim at a time. */
async function overFreeLimit(space: { id: string; user: { id: string } }) {
  const [user, open] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: space.user.id }, select: { plan: true } }),
    prisma.claim.count({ where: { householdId: space.id, status: { in: ["DRAFT", "SENT"] } } }),
  ]);
  return !hasPro(user) && open >= FREE_OPEN_CLAIMS;
}

/** Opens a claim with its letter already written; returns the claim to show. */
export async function openClaim(input: unknown): Promise<ActionResult & { id?: string }> {
  const space = await requireSpace();
  const parsed = openClaimSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;

  const claimOfFinding = () =>
    data.findingKey
      ? prisma.claim.findUnique({
          where: { householdId_findingKey: { householdId: space.id, findingKey: data.findingKey } },
          select: { id: true },
        })
      : Promise.resolve(null);
  // The same finding again: go to its claim instead of opening a second one.
  const existing = await claimOfFinding();
  if (existing) return { ok: true, id: existing.id };

  if (await overFreeLimit(space)) return FREE_LIMIT;

  let charge: { date: string; description: string; category: string | null } | null = null;
  if (data.transactionId) {
    const tx = await prisma.transaction.findFirst({
      where: { id: data.transactionId, householdId: space.id, type: "EXPENSE" },
      select: { date: true, description: true, category: { select: { name: true } } },
    });
    if (!tx) return { ok: false, error: "Movimento non trovato." };
    charge = {
      date: toDateInputValue(tx.date),
      description: tx.description,
      category: tx.category?.name ?? null,
    };
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: space.user.id },
    select: { name: true },
  });
  const chargeDate = charge?.date ?? data.chargeDate;
  const letter = claimLetter({
    kind: data.kind,
    fullName: user.name ?? "",
    counterparty: data.counterparty,
    amount: Number(data.amount),
    currency: space.currency,
    today: today(),
    chargeDate,
    chargeDescription: charge?.description ?? null,
    effectiveFrom: data.effectiveFrom,
    aboutFees: charge
      ? looksLikeBankFee(charge.description, charge.category)
      : data.findingKey === "fees",
  });
  const deadline = draftDeadline(data.kind, chargeDate);

  try {
    const claim = await prisma.claim.create({
      data: {
        householdId: space.id,
        userId: space.user.id,
        kind: data.kind,
        findingKey: data.findingKey,
        transactionId: data.transactionId,
        counterparty: data.counterparty,
        expectedAmount: data.amount,
        subject: letter.subject,
        body: letter.body,
        // Only a cancellation has a date from which charges must stop.
        effectiveFrom:
          data.kind === "CANCELLATION" && data.effectiveFrom ? asDate(data.effectiveFrom) : null,
        deadline: deadline ? asDate(deadline) : null,
      },
      select: { id: true },
    });
    revalidate(claim.id);
    return { ok: true, id: claim.id };
  } catch (error) {
    // The same finding opened twice at once (two tabs): the unique index keeps one claim.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await claimOfFinding();
      if (winner) return { ok: true, id: winner.id };
    }
    throw error;
  }
}

/** The letter can be edited until it's sent: what was sent is the record. */
export async function updateClaimLetter(id: unknown, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const claimId = idSchema.safeParse(id);
  if (!claimId.success) return NOT_FOUND;
  const parsed = letterSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const { count } = await prisma.claim.updateMany({
    where: { id: claimId.data, householdId: space.id, status: "DRAFT" },
    data: parsed.data,
  });
  if (count === 0) {
    return {
      ok: false,
      error: "Pratica non trovata, o già inviata: la lettera inviata non cambia.",
    };
  }
  revalidate(claimId.data);
  return { ok: true };
}

/** The user sent the letter: from now on the deadline is the other side's. */
export async function markClaimSent(id: unknown, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const claimId = idSchema.safeParse(id);
  if (!claimId.success) return NOT_FOUND;
  const parsed = markSentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const claim = await prisma.claim.findFirst({
    where: { id: claimId.data, householdId: space.id },
    select: {
      kind: true,
      status: true,
      effectiveFrom: true,
      transaction: { select: { description: true, category: { select: { name: true } } } },
    },
  });
  if (!claim) return NOT_FOUND;
  if (claim.status !== "DRAFT") return { ok: false, error: "La pratica risulta già inviata." };

  const effectiveFrom =
    parsed.data.effectiveFrom ??
    (claim.effectiveFrom ? toDateInputValue(claim.effectiveFrom) : null);
  if (claim.kind === "CANCELLATION" && !effectiveFrom) {
    return {
      ok: false,
      fieldErrors: { effectiveFrom: ["Indica da quando non devono più addebitarti niente"] },
    };
  }
  // A charge taken by someone else is a payment service; the bank's own fees aren't.
  const contestsPayment =
    claim.transaction !== null &&
    !looksLikeBankFee(claim.transaction.description, claim.transaction.category?.name ?? null);
  const deadline = answerDeadline(claim.kind, parsed.data.sentAt, contestsPayment);

  const { count } = await prisma.claim.updateMany({
    where: { id: claimId.data, householdId: space.id, status: "DRAFT" },
    data: {
      status: "SENT",
      channel: parsed.data.channel,
      sentAt: asDate(parsed.data.sentAt),
      ...(claim.kind === "CANCELLATION" ? { effectiveFrom: asDate(effectiveFrom!) } : {}),
      deadline: deadline ? asDate(deadline) : null,
    },
  });
  if (count === 0) return NOT_FOUND;
  revalidate(claimId.data);
  return { ok: true };
}

/** How it ended: money back (in full or in part), refused, or dropped. */
export async function recordClaimOutcome(id: unknown, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const claimId = idSchema.safeParse(id);
  if (!claimId.success) return NOT_FOUND;
  const parsed = outcomeSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const { count } = await prisma.claim.updateMany({
    where: { id: claimId.data, householdId: space.id },
    data: {
      status: parsed.data.status,
      recoveredAmount: parsed.data.recoveredAmount,
      notes: parsed.data.notes,
      closedAt: new Date(),
    },
  });
  if (count === 0) return NOT_FOUND;
  revalidate(claimId.data);
  return { ok: true };
}

/** Back to where it was before the outcome: sent if it had been, otherwise a draft. */
export async function reopenClaim(id: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const claimId = idSchema.safeParse(id);
  if (!claimId.success) return NOT_FOUND;

  const claim = await prisma.claim.findFirst({
    where: { id: claimId.data, householdId: space.id },
    select: { status: true, sentAt: true },
  });
  if (!claim) return NOT_FOUND;
  if (isOpenClaim(claim.status)) return { ok: true };
  if (await overFreeLimit(space)) return FREE_LIMIT;

  await prisma.claim.updateMany({
    where: { id: claimId.data, householdId: space.id },
    data: {
      status: claim.sentAt ? "SENT" : "DRAFT",
      recoveredAmount: null,
      closedAt: null,
    },
  });
  revalidate(claimId.data);
  return { ok: true };
}

export async function deleteClaim(id: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const claimId = idSchema.safeParse(id);
  if (!claimId.success) return NOT_FOUND;
  const { count } = await prisma.claim.deleteMany({
    where: { id: claimId.data, householdId: space.id },
  });
  if (count === 0) return NOT_FOUND;
  revalidate();
  return { ok: true };
}
