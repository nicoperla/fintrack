"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { soloSpace } from "@/lib/data/together";
import { personalSpaceName } from "@/lib/households";
import { readShares, SHARE_ITEMS } from "@/lib/finance/together";
import type { ActionResult } from "@/lib/action-result";

/*
 * "Mio, tuo, nostro": what of their own personal space a member shows in the active shared space.
 * Each member decides only for themselves.
 */

const sharesSchema = z.array(z.enum(SHARE_ITEMS)).max(SHARE_ITEMS.length);

export async function setShares(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  const parsed = sharesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Scelta non valida." };
  const members = await prisma.householdMember.count({ where: { householdId: space.id } });
  if (members < 2) return { ok: false, error: "Si mostra qualcosa solo in uno spazio condiviso." };

  const { count } = await prisma.householdMember.updateMany({
    where: { householdId: space.id, userId: space.user.id },
    data: { shares: readShares(parsed.data) },
  });
  if (count === 0) return { ok: false, error: "Non fai parte di questo spazio." };
  revalidatePath("/insieme");
  return { ok: true };
}

/**
 * A space of one's own for someone whose personal space became the shared one (who invited the
 * partner into it): the "mine" next to the "ours". Only if they have none.
 */
export async function createPersonalSpace(): Promise<ActionResult> {
  const space = await requireSpace();
  if (await soloSpace(space.user.id)) {
    return { ok: false, error: "Hai già uno spazio personale: lo trovi nel selettore in alto." };
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: space.user.id },
    select: { name: true, email: true },
  });
  await prisma.household.create({
    data: {
      name: personalSpaceName(user),
      ownerId: space.user.id,
      currency: space.currency,
      members: { create: { userId: space.user.id, role: "OWNER" } },
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
