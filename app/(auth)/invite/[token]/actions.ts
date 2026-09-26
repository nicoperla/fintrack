"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { findInvite } from "@/lib/households";

/** Joins the space of a valid invitation addressed to the signed-in user, and switches to it. */
export async function acceptInvite(token: string) {
  const session = await getSession();
  if (!session) redirect(`/login?callbackUrl=/invite/${encodeURIComponent(token)}`);

  const invite = await findInvite(token);
  const email = session.user.email?.toLowerCase();
  if (!invite || invite.email.toLowerCase() !== email) redirect(`/invite/${token}`);

  await prisma.$transaction([
    prisma.householdMember.upsert({
      where: { householdId_userId: { householdId: invite.householdId, userId: session.user.id } },
      create: { householdId: invite.householdId, userId: session.user.id, role: "MEMBER" },
      update: {},
    }),
    prisma.householdInvite.delete({ where: { id: invite.id } }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { activeHouseholdId: invite.householdId },
    }),
  ]);
  redirect("/dashboard");
}
