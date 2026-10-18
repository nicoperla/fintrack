"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { hasPro } from "@/lib/billing/plan";
import { readDocStates } from "@/lib/tax/documents";
import { readTaxProfile, type TaxProfile } from "@/lib/finance/rights";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";
import {
  cuSchema,
  decisionSchema,
  docKeySchema,
  docStateSchema,
  homeBonusSchema,
  resultSchema,
  sentSchema,
  situationSchema,
  taxYearSchema,
} from "@/lib/validations/tax";
import { validationError, type ActionResult } from "@/lib/action-result";

/*
 * "Il mio 730": everything here belongs to the person, not to the space (each one files their
 * own 730), so every row is keyed by the signed-in user. Nothing from the precompilato or the
 * 730-3 is stored apart from the final result the user types.
 */

const BAD_YEAR: ActionResult = { ok: false, error: "Anno non valido." };
const PRO_ONLY: ActionResult = {
  ok: false,
  error: "La cartellina delle ricevute fa parte di Orbitly Pro.",
};

function revalidate() {
  revalidatePath("/730");
  revalidatePath("/ritrovati");
}

function parseYear(year: unknown) {
  const parsed = taxYearSchema(todayInAppTimeZone().year).safeParse(year);
  return parsed.success ? parsed.data : null;
}

type YearData = Omit<
  Prisma.TaxYearUncheckedCreateInput,
  "id" | "userId" | "year" | "createdAt" | "updatedAt"
>;

/** Creates the person's row for the year on the first answer, then updates it. */
async function saveYear(userId: string, year: number, data: YearData) {
  await prisma.taxYear.upsert({
    where: { userId_year: { userId, year } },
    create: { userId, year, ...data },
    update: data,
  });
  revalidate();
}

/** "Chi sei": the six answers about the year. */
export async function saveSituation(year: unknown, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const y = parseYear(year);
  if (y === null) return BAD_YEAR;
  const parsed = situationSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const s = parsed.data;
  const answers = {
    ...s,
    // Nobody to make the refund at year's end: there's no "agent" question to answer.
    agent: s.work === "none" ? false : s.agent,
    childrenShare: s.children > 0 ? s.childrenShare : 50,
    childIncomeRisk: s.children > 0 ? s.childIncomeRisk : false,
    answeredAt: new Date().toISOString(),
  };
  await saveYear(space.user.id, y, { answers });
  return { ok: true };
}

/** The Certificazioni Uniche figures, for the estimate. An empty list removes them. */
export async function saveCu(year: unknown, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const y = parseYear(year);
  if (y === null) return BAD_YEAR;
  const parsed = cuSchema.safeParse(input);
  if (!parsed.success) {
    // Errors by row and field ("entries.1.withheld"): the form shows each under its CU.
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return { ok: false, fieldErrors };
  }
  await saveYear(space.user.id, y, {
    cu: parsed.data.entries.length ? parsed.data : Prisma.DbNull,
  });
  return { ok: true };
}

/** A document of the list: "have", "skip" (doesn't apply), or null to go back to "to do". */
export async function setDocState(
  year: unknown,
  key: unknown,
  state: unknown,
): Promise<ActionResult> {
  const space = await requireSpace();
  const y = parseYear(year);
  if (y === null) return BAD_YEAR;
  const k = docKeySchema.safeParse(key);
  const s = docStateSchema.safeParse(state);
  if (!k.success || !s.success) return { ok: false, error: "Documento non valido." };
  const row = await prisma.taxYear.findUnique({
    where: { userId_year: { userId: space.user.id, year: y } },
    select: { documents: true },
  });
  const documents = readDocStates(row?.documents);
  if (s.data) documents[k.data] = s.data;
  else delete documents[k.data];
  await saveYear(space.user.id, y, { documents });
  return { ok: true };
}

/** The folder: the receipt of one of the user's own deductible expenses is ready (or not). */
export async function setExpenseDoc(transactionId: unknown, have: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: space.user.id },
    select: { plan: true },
  });
  if (!hasPro(user)) return PRO_ONLY;
  const id = z.string().min(1).max(40).safeParse(transactionId);
  const flag = z.boolean().safeParse(have);
  if (!id.success || !flag.success) return { ok: false, error: "Scelta non valida." };
  const { count } = await prisma.transaction.updateMany({
    where: { id: id.data, householdId: space.id, userId: space.user.id, type: "EXPENSE" },
    data: { deductionDoc: flag.data ? "have" : null },
  });
  if (count === 0) return { ok: false, error: "Movimento non trovato." };
  revalidate();
  return { ok: true };
}

/** After reading the precompilato: accept it, change it, or go to a CAF (null: undecided). */
export async function setDecision(year: unknown, decision: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const y = parseYear(year);
  if (y === null) return BAD_YEAR;
  const parsed = decisionSchema.safeParse(decision);
  if (!parsed.success) return { ok: false, error: "Scelta non valida." };
  await saveYear(space.user.id, y, { decision: parsed.data });
  return { ok: true };
}

/** "Ho inviato": how and when. The date can't be in the future or before the season. */
export async function markSent(year: unknown, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const y = parseYear(year);
  if (y === null) return BAD_YEAR;
  const parsed = sentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const t = todayInAppTimeZone();
  const today = toDateInputValue(utcDate(t.year, t.month, t.day));
  const { sentAt, channel } = parsed.data;
  if (sentAt > today || sentAt < `${y + 1}-01-01`) {
    return {
      ok: false,
      fieldErrors: { sentAt: [`Scegli un giorno tra il 1° gennaio ${y + 1} e oggi`] },
    };
  }
  await saveYear(space.user.id, y, {
    channel,
    sentAt: new Date(`${sentAt}T00:00:00Z`),
  });
  return { ok: true };
}

/** Back to "not sent yet": also forgets the result, which belonged to that filing. */
export async function unmarkSent(year: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const y = parseYear(year);
  if (y === null) return BAD_YEAR;
  await saveYear(space.user.id, y, {
    channel: null,
    sentAt: null,
    result: null,
    secondAdvance: null,
    refundReceivedAt: null,
  });
  return { ok: true };
}

/** The result of the 730-3, typed by the user. */
export async function saveResult(year: unknown, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const y = parseYear(year);
  if (y === null) return BAD_YEAR;
  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { direction, amount, secondAdvance } = parsed.data;
  if (direction !== "zero" && !amount) {
    return { ok: false, fieldErrors: { amount: ["Scrivi l'importo del prospetto"] } };
  }
  const result = direction === "zero" ? 0 : direction === "refund" ? amount! : -amount!;
  await saveYear(space.user.id, y, {
    result,
    secondAdvance,
    refundReceivedAt: direction === "refund" ? undefined : null,
  });
  return { ok: true };
}

/** The refund arrived (true) or not yet (false). */
export async function markRefundReceived(year: unknown, received: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const y = parseYear(year);
  if (y === null) return BAD_YEAR;
  const flag = z.boolean().safeParse(received);
  if (!flag.success) return { ok: false, error: "Scelta non valida." };
  const t = todayInAppTimeZone();
  await saveYear(space.user.id, y, {
    refundReceivedAt: flag.data ? utcDate(t.year, t.month, t.day) : null,
  });
  return { ok: true };
}

/** "Chi detrae cosa": let the space know whether this person has tax to deduct from. */
export async function setShareCapacity(year: unknown, share: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const y = parseYear(year);
  if (y === null) return BAD_YEAR;
  const flag = z.boolean().safeParse(share);
  if (!flag.success) return { ok: false, error: "Scelta non valida." };
  await saveYear(space.user.id, y, { shareCapacity: flag.data });
  return { ok: true };
}

/** The person's tax profile (users.tax_profile), changed and saved. */
async function updateProfile(userId: string, change: (profile: TaxProfile) => TaxProfile) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { taxProfile: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { taxProfile: change(readTaxProfile(user.taxProfile)) },
  });
  revalidate();
  revalidatePath("/ritrovati/radar");
}

const MAX_HOME_BONUSES = 20;

/** Adds a home bonus (id null) or changes one: its ten instalments follow from year and rate. */
export async function saveHomeBonus(id: unknown, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = homeBonusSchema(todayInAppTimeZone().year).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const existing = id === null ? null : z.string().min(1).max(40).safeParse(id);
  if (existing && !existing.success) return { ok: false, error: "Bonus non trovato." };
  let result: ActionResult = { ok: true };
  await updateProfile(space.user.id, (profile) => {
    const list = profile.homeBonuses;
    if (existing?.success) {
      if (!list.some((b) => b.id === existing.data)) {
        result = { ok: false, error: "Bonus non trovato." };
        return profile;
      }
      return {
        ...profile,
        homeBonuses: list.map((b) => (b.id === existing.data ? { ...b, ...parsed.data } : b)),
      };
    }
    if (list.length >= MAX_HOME_BONUSES) {
      result = { ok: false, error: `Al massimo ${MAX_HOME_BONUSES} bonus.` };
      return profile;
    }
    const newId = `hb${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    return { ...profile, homeBonuses: [...list, { id: newId, ...parsed.data }] };
  });
  return result;
}

export async function deleteHomeBonus(id: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = z.string().min(1).max(40).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Bonus non trovato." };
  await updateProfile(space.user.id, (profile) => ({
    ...profile,
    homeBonuses: profile.homeBonuses.filter((b) => b.id !== parsed.data),
  }));
  return { ok: true };
}
