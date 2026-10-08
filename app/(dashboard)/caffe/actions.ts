"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";
import { OPEN_DECISIONS_LIMIT } from "@/lib/finance/money-talk";
import { decisionSchema, monthKeySchema } from "@/lib/validations/money-talk";
import { validationError, type ActionResult } from "@/lib/action-result";

/*
 * "Il caffè dei conti": the talks a shared space has done and the decisions it took. Every write
 * is scoped to the active space, and only a space with more than one person has talks.
 */

const NOT_FOUND: ActionResult = { ok: false, error: "Non trovata: forse è già stata eliminata." };
const SOLO: ActionResult = {
  ok: false,
  error: "Il caffè dei conti si fa in due: invita qualcuno nello spazio.",
};
const BAD_MONTH: ActionResult = { ok: false, error: "Si parla solo di un mese già finito." };

function refresh() {
  revalidatePath("/caffe");
  revalidatePath("/dashboard");
}

const isShared = async (householdId: string) =>
  (await prisma.householdMember.count({ where: { householdId } })) >= 2;

/** "YYYY-MM" of a month already over → its first day; null otherwise. */
function pastMonth(key: string) {
  const parsed = monthKeySchema.safeParse(key);
  if (!parsed.success) return null;
  const month = new Date(`${parsed.data}-01T00:00:00Z`);
  const t = todayInAppTimeZone();
  return month < utcDate(t.year, t.month, 1) ? month : null;
}

export async function addDecision(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const t = todayInAppTimeZone();
  const parsed = decisionSchema(toDateInputValue(utcDate(t.year, t.month, t.day))).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { month: key, topic, text, ownerId, dueOn } = parsed.data;
  const month = pastMonth(key);
  if (!month) return BAD_MONTH;
  if (!(await isShared(space.id))) return SOLO;

  if (ownerId) {
    const member = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId: space.id, userId: ownerId } },
      select: { userId: true },
    });
    if (!member)
      return { ok: false, fieldErrors: { ownerId: ["Scegliete qualcuno dello spazio"] } };
  }
  const open = await prisma.moneyDecision.count({
    where: { householdId: space.id, doneAt: null },
  });
  if (open >= OPEN_DECISIONS_LIMIT) {
    return {
      ok: false,
      error: `Avete già ${OPEN_DECISIONS_LIMIT} decisioni aperte: chiudetene qualcuna prima.`,
    };
  }

  await prisma.moneyDecision.create({
    data: {
      householdId: space.id,
      month,
      topic,
      text,
      ownerId,
      dueOn: dueOn ? new Date(`${dueOn}T00:00:00Z`) : null,
    },
  });
  refresh();
  return { ok: true };
}

export async function setDecisionDone(id: string, done: boolean): Promise<ActionResult> {
  const space = await requireSpace();
  const { count } = await prisma.moneyDecision.updateMany({
    where: { id, householdId: space.id },
    data: { doneAt: done ? new Date() : null },
  });
  if (count === 0) return NOT_FOUND;
  refresh();
  return { ok: true };
}

export async function deleteDecision(id: string): Promise<ActionResult> {
  const space = await requireSpace();
  const { count } = await prisma.moneyDecision.deleteMany({
    where: { id, householdId: space.id },
  });
  if (count === 0) return NOT_FOUND;
  refresh();
  return { ok: true };
}

/** The talk about `month` is done: the dashboard and the digest stop reminding it. */
export async function markTalkHeld(key: string): Promise<ActionResult> {
  const space = await requireSpace();
  const month = pastMonth(key);
  if (!month) return BAD_MONTH;
  if (!(await isShared(space.id))) return SOLO;
  await prisma.moneyTalk.upsert({
    where: { householdId_month: { householdId: space.id, month } },
    create: { householdId: space.id, month, heldById: space.user.id },
    update: {},
  });
  refresh();
  return { ok: true };
}

/** Marked as done by mistake. */
export async function undoTalk(key: string): Promise<ActionResult> {
  const space = await requireSpace();
  const month = pastMonth(key);
  if (!month) return BAD_MONTH;
  await prisma.moneyTalk.deleteMany({ where: { householdId: space.id, month } });
  refresh();
  return { ok: true };
}
