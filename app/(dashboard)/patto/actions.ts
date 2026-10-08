"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { getAppUrl } from "@/lib/app-url";
import { newShareToken } from "@/lib/family-file-tokens";
import { formatRetryAfter, rateLimit, RULES } from "@/lib/rate-limit";
import { pactSpent, todayIso } from "@/lib/data/pacts";
import { linkExpiry, MAX_ACTIVE_PACTS, pactPeriod, pactStatus } from "@/lib/finance/pacts";
import { pactSchema } from "@/lib/validations/pacts";
import { toDateInputValue } from "@/lib/format";
import { validationError, type ActionResult } from "@/lib/action-result";

/*
 * "Il patto": personal, so only its author changes it; scoped to the active space like the rest.
 * The referee's link is shown once: only the SHA-256 of its token is stored.
 */

const NOT_FOUND: ActionResult = { ok: false, error: "Patto non trovato." };
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const refereeLink = (token: string) => `${getAppUrl()}/patto/arbitro/${token}`;

function refresh() {
  revalidatePath("/patto");
  revalidatePath("/budgets");
}

async function slowDown(userId: string): Promise<ActionResult | null> {
  const limit = await rateLimit(`pacts:user:${userId}`, RULES.pacts);
  return limit.ok
    ? null
    : {
        ok: false,
        error: `Hai fatto molti patti oggi: riprova tra ${formatRetryAfter(limit.retryAfterSeconds)}.`,
      };
}

/** The author's own pact in the active space. */
const ownPact = (id: string, householdId: string, userId: string) =>
  prisma.pact.findFirst({
    where: { id, householdId, userId },
    select: {
      id: true,
      householdId: true,
      userId: true,
      categoryId: true,
      limit: true,
      periodFrom: true,
      periodTo: true,
      onlyMine: true,
      refereeName: true,
      fineAmount: true,
      goalId: true,
      finePaidAt: true,
      category: { select: { children: { select: { id: true } } } },
    },
  });

export async function createPact(input: unknown): Promise<ActionResult & { link?: string }> {
  const space = await requireSpace();
  const parsed = pactSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const p = parsed.data;
  const today = todayIso();

  const [category, goal, active] = await Promise.all([
    prisma.category.findFirst({
      where: { id: p.categoryId, householdId: space.id, type: "EXPENSE" },
      select: { id: true },
    }),
    p.goalId
      ? prisma.goal.findFirst({
          where: { id: p.goalId, householdId: space.id },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.pact.count({
      where: { householdId: space.id, userId: space.user.id, periodTo: { gte: asDate(today) } },
    }),
  ]);
  if (!category) return { ok: false, fieldErrors: { categoryId: ["Scegli la categoria"] } };
  if (p.goalId && !goal) return { ok: false, fieldErrors: { goalId: ["Scegli un obiettivo"] } };
  if (active >= MAX_ACTIVE_PACTS) {
    return {
      ok: false,
      error: `Hai già ${MAX_ACTIVE_PACTS} patti in corso: un patto funziona se è uno dei pochi pensieri del mese.`,
    };
  }
  const slow = await slowDown(space.user.id);
  if (slow) return slow;

  const period = pactPeriod(p.start, today);
  const share = p.refereeName ? newShareToken() : null;
  await prisma.pact.create({
    data: {
      householdId: space.id,
      userId: space.user.id,
      categoryId: p.categoryId,
      limit: p.limit,
      periodFrom: asDate(period.from),
      periodTo: asDate(period.to),
      onlyMine: p.onlyMine,
      refereeName: p.refereeName,
      refereeTokenHash: share?.hash ?? null,
      promise: p.promise,
      fineAmount: p.fineAmount,
      goalId: p.fineAmount !== null ? p.goalId : null,
    },
  });
  refresh();
  return share ? { ok: true, link: refereeLink(share.token) } : { ok: true };
}

/** A fresh link for the referee; the old one stops working. */
export async function newRefereeLink(id: string): Promise<ActionResult & { link?: string }> {
  const space = await requireSpace();
  const pact = await ownPact(id, space.id, space.user.id);
  if (!pact || !pact.refereeName) return NOT_FOUND;
  if (linkExpiry(toDateInputValue(pact.periodTo)) < todayIso()) {
    return { ok: false, error: "Il patto è finito da più di un mese: il link non serve più." };
  }
  const slow = await slowDown(space.user.id);
  if (slow) return slow;
  const { token, hash } = newShareToken();
  await prisma.pact.update({ where: { id: pact.id }, data: { refereeTokenHash: hash } });
  refresh();
  return { ok: true, link: refereeLink(token) };
}

export async function revokeRefereeLink(id: string): Promise<ActionResult> {
  const space = await requireSpace();
  const { count } = await prisma.pact.updateMany({
    where: { id, householdId: space.id, userId: space.user.id },
    data: { refereeTokenHash: null },
  });
  if (count === 0) return NOT_FOUND;
  refresh();
  return { ok: true };
}

export async function deletePact(id: string): Promise<ActionResult> {
  const space = await requireSpace();
  const { count } = await prisma.pact.deleteMany({
    where: { id, householdId: space.id, userId: space.user.id },
  });
  if (count === 0) return NOT_FOUND;
  refresh();
  return { ok: true };
}

/**
 * The pact is lost and the fine is in the goal: the goal grows by it. FinTrack doesn't move the
 * money; the author confirms they did.
 */
export async function payFine(id: string): Promise<ActionResult> {
  const space = await requireSpace();
  const pact = await ownPact(id, space.id, space.user.id);
  if (!pact) return NOT_FOUND;
  if (pact.fineAmount === null || pact.goalId === null) {
    return { ok: false, error: "Questo patto non ha una multa da mettere da parte." };
  }
  if (pact.finePaidAt) return { ok: false, error: "La multa è già nel tuo obiettivo." };
  const spent = await pactSpent(pact);
  const status = pactStatus({
    limit: Number(pact.limit),
    from: toDateInputValue(pact.periodFrom),
    to: toDateInputValue(pact.periodTo),
    spent,
    today: todayIso(),
  });
  if (status.state !== "lost") return { ok: false, error: "Il patto non è perso: niente multa." };

  // Both or neither, and only once even with two clicks at the same time.
  const paid = await prisma.$transaction(async (tx) => {
    const { count } = await tx.pact.updateMany({
      where: { id: pact.id, finePaidAt: null },
      data: { finePaidAt: new Date() },
    });
    if (count === 0) return false;
    await tx.goal.updateMany({
      where: { id: pact.goalId!, householdId: space.id },
      data: { currentAmount: { increment: pact.fineAmount! } },
    });
    return true;
  });
  if (!paid) return { ok: false, error: "La multa è già nel tuo obiettivo." };
  revalidatePath("/", "layout");
  return { ok: true };
}
