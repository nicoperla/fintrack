"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { journeyByKey } from "@/lib/journeys/catalog";
import {
  documentSchema,
  journeyKeySchema,
  startJourneySchema,
  stepKeySchema,
} from "@/lib/validations/journeys";
import { validationError, type ActionResult } from "@/lib/action-result";

/*
 * "Percorsi e scadenze": journeys and documents belong to the person, not to the space, like
 * the 730. The date of the event can be in the past (it happened) or in the future (it's
 * coming): either way it's within a few years.
 */

const MAX_DOCUMENTS = 30;
const NOT_FOUND: ActionResult = { ok: false, error: "Non trovato." };

function revalidate(key?: string) {
  revalidatePath("/percorsi");
  if (key) revalidatePath(`/percorsi/${key}`);
}

const withinYears = (iso: string, years: number) => {
  const now = Date.now();
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Math.abs(t - now) <= years * 366 * 86_400_000;
};

/** Starts a journey from the day of the event, or moves that day (the steps done stay done). */
export async function startJourney(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = startJourneySchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { key, eventDate } = parsed.data;
  if (!withinYears(eventDate, 3)) {
    return { ok: false, fieldErrors: { eventDate: ["Scegli una data entro tre anni da oggi"] } };
  }
  const date = new Date(`${eventDate}T00:00:00Z`);
  await prisma.userJourney.upsert({
    where: { userId_key: { userId: space.user.id, key } },
    create: { userId: space.user.id, key, eventDate: date },
    update: { eventDate: date },
  });
  revalidate(key);
  return { ok: true };
}

/** Marks a step done (or not done). */
export async function setStepDone(
  key: unknown,
  step: unknown,
  done: unknown,
): Promise<ActionResult> {
  const space = await requireSpace();
  const k = journeyKeySchema.safeParse(key);
  const s = stepKeySchema.safeParse(step);
  const d = z.boolean().safeParse(done);
  if (!k.success || !s.success || !d.success) return { ok: false, error: "Scelta non valida." };
  if (!journeyByKey(k.data)?.steps.some((x) => x.key === s.data)) return NOT_FOUND;
  const row = await prisma.userJourney.findUnique({
    where: { userId_key: { userId: space.user.id, key: k.data } },
    select: { done: true },
  });
  if (!row) return NOT_FOUND;
  const next = d.data
    ? Array.from(new Set([...row.done, s.data]))
    : row.done.filter((x) => x !== s.data);
  await prisma.userJourney.update({
    where: { userId_key: { userId: space.user.id, key: k.data } },
    data: { done: next },
  });
  revalidate(k.data);
  return { ok: true };
}

export async function stopJourney(key: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const k = journeyKeySchema.safeParse(key);
  if (!k.success) return { ok: false, error: "Percorso non valido." };
  await prisma.userJourney.deleteMany({ where: { userId: space.user.id, key: k.data } });
  revalidate(k.data);
  return { ok: true };
}

/** Adds a document (id null) or changes one. */
export async function saveDocument(id: unknown, input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  if (!withinYears(parsed.data.expiresOn, 20)) {
    return { ok: false, fieldErrors: { expiresOn: ["Controlla la data di scadenza"] } };
  }
  const data = { ...parsed.data, expiresOn: new Date(`${parsed.data.expiresOn}T00:00:00Z`) };
  if (id === null) {
    const count = await prisma.personalDocument.count({ where: { userId: space.user.id } });
    if (count >= MAX_DOCUMENTS)
      return { ok: false, error: `Al massimo ${MAX_DOCUMENTS} documenti.` };
    await prisma.personalDocument.create({ data: { userId: space.user.id, ...data } });
  } else {
    const docId = z.string().min(1).max(40).safeParse(id);
    if (!docId.success) return NOT_FOUND;
    const { count } = await prisma.personalDocument.updateMany({
      where: { id: docId.data, userId: space.user.id },
      data,
    });
    if (count === 0) return NOT_FOUND;
  }
  revalidate();
  return { ok: true };
}

export async function deleteDocument(id: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const docId = z.string().min(1).max(40).safeParse(id);
  if (!docId.success) return NOT_FOUND;
  const { count } = await prisma.personalDocument.deleteMany({
    where: { id: docId.data, userId: space.user.id },
  });
  if (count === 0) return NOT_FOUND;
  revalidate();
  return { ok: true };
}
