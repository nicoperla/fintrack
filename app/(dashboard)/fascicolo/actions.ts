"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { hasPro } from "@/lib/billing/plan";
import { getAppUrl } from "@/lib/app-url";
import { MAX_ACTIVE_SHARES } from "@/lib/family-file";
import { newShareToken } from "@/lib/family-file-tokens";
import { RULES, formatRetryAfter, rateLimit } from "@/lib/rate-limit";
import { notesSchema, shareSchema } from "@/lib/validations/family-file";
import { validationError, type ActionResult } from "@/lib/action-result";

/*
 * "Il fascicolo di famiglia": the notes of the space, and the read-only links for a trusted
 * person. Everyone in the space writes the notes and can revoke a link; only the owner shares the
 * space's data outside it. Links are shown once: only the SHA-256 of their token is stored.
 */

const DAY_MS = 86_400_000;
const idSchema = z.string().min(1).max(40);

export async function saveFamilyNotes(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = notesSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  await prisma.familyFile.upsert({
    where: { householdId: space.id },
    create: { householdId: space.id, notes: parsed.data },
    update: { notes: parsed.data },
  });
  revalidatePath("/fascicolo");
  return { ok: true };
}

export async function createFamilyShare(input: unknown): Promise<ActionResult & { link?: string }> {
  const space = await requireSpace();
  if (space.role !== "OWNER") {
    return { ok: false, error: "Solo chi ha creato lo spazio può condividerne il fascicolo." };
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: space.user.id },
    select: { plan: true },
  });
  if (!hasPro(user)) {
    return { ok: false, error: "La condivisione del fascicolo fa parte di FinTrack Pro." };
  }
  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const limit = await rateLimit(`family-shares:user:${space.user.id}`, RULES.familyShares);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Hai creato molti link: riprova tra ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    };
  }
  const active = await prisma.familyFileShare.count({
    where: { householdId: space.id, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (active >= MAX_ACTIVE_SHARES) {
    return {
      ok: false,
      error: `Ci sono già ${MAX_ACTIVE_SHARES} link attivi: revocane uno prima di crearne un altro.`,
    };
  }

  const { token, hash } = newShareToken();
  await prisma.familyFileShare.create({
    data: {
      householdId: space.id,
      tokenHash: hash,
      label: parsed.data.label,
      showAmounts: parsed.data.showAmounts,
      expiresAt: new Date(Date.now() + parsed.data.days * DAY_MS),
    },
  });
  revalidatePath("/fascicolo");
  return { ok: true, link: `${getAppUrl()}/fascicolo/condiviso/${token}` };
}

export async function revokeFamilyShare(id: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const shareId = idSchema.safeParse(id);
  if (!shareId.success) return { ok: false, error: "Link non trovato." };
  const { count } = await prisma.familyFileShare.updateMany({
    where: { id: shareId.data, householdId: space.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) return { ok: false, error: "Link non trovato." };
  revalidatePath("/fascicolo");
  return { ok: true };
}
