"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { currencySchema } from "@/lib/validations/finance";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/reports/digest";
import { CurrencyError } from "@/lib/currency/convert";
import { createConverter, latestConverter } from "@/lib/currency/rates";
import { hashInviteToken } from "@/lib/households";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MEMBERS = 10;

const OWNER_ONLY: ActionResult = {
  ok: false,
  error: "Solo chi ha creato lo spazio può farlo.",
};

function refresh() {
  revalidatePath("/", "layout");
}

export async function switchSpace(householdId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (!space.spaces.some((s) => s.id === householdId)) {
    return { ok: false, error: "Non fai parte di questo spazio." };
  }
  await prisma.user.update({
    where: { id: space.user.id },
    data: { activeHouseholdId: householdId },
  });
  refresh();
  return { ok: true };
}

const nameSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome allo spazio").max(40, "Massimo 40 caratteri"),
});

export async function renameSpace(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  if (space.role !== "OWNER") return OWNER_ONLY;
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  await prisma.household.update({ where: { id: space.id }, data: { name: parsed.data.name } });
  refresh();
  return { ok: true };
}

/**
 * Changes the base currency: every transaction's base amount is recomputed at the rate of its
 * own date, and budgets, goals and debts are converted at today's rate.
 */
export async function setSpaceCurrency(input: unknown): Promise<ActionResult> {
  const space = await requireSpace();
  if (space.role !== "OWNER") return OWNER_ONLY;
  const parsed = z.object({ currency: currencySchema }).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const next = parsed.data.currency;
  if (next === space.currency) return { ok: true };

  const [transactions, budgets, goals, debts] = await Promise.all([
    prisma.transaction.findMany({
      where: { householdId: space.id },
      select: { id: true, amount: true, date: true, account: { select: { currency: true } } },
    }),
    prisma.budget.findMany({ where: { householdId: space.id } }),
    prisma.goal.findMany({ where: { householdId: space.id } }),
    prisma.debt.findMany({ where: { householdId: space.id } }),
  ]);

  let updates: { id: string; base: string }[];
  let today: Awaited<ReturnType<typeof latestConverter>>;
  try {
    const currencies = [space.currency, next, ...transactions.map((t) => t.account.currency)];
    const times = transactions.map((t) => t.date.getTime());
    const converter = times.length
      ? await createConverter(
          currencies,
          new Date(Math.min(...times)),
          new Date(Math.max(...times)),
        )
      : null;
    updates = transactions.map((t) => ({
      id: t.id,
      base: converter!.convert(Number(t.amount), t.account.currency, next, t.date).toFixed(2),
    }));
    today = await latestConverter([space.currency, next]);
    today.convert(1, space.currency, next, new Date()); // fail early if the rate is unknown
  } catch (error) {
    if (error instanceof CurrencyError) return { ok: false, error: error.message };
    throw error;
  }
  const now = new Date();
  const convert = (value: Prisma.Decimal) =>
    today.convert(value.toNumber(), space.currency, next, now).toFixed(2);

  await prisma.$transaction(
    async (tx) => {
      // One statement per chunk instead of one per row.
      for (let i = 0; i < updates.length; i += 500) {
        const chunk = updates.slice(i, i + 500);
        await tx.$executeRaw`
          UPDATE "transactions" AS t SET "base_amount" = v.base::numeric
          FROM (VALUES ${Prisma.join(chunk.map((u) => Prisma.sql`(${u.id}, ${u.base})`))}) AS v(id, base)
          WHERE t."id" = v.id AND t."household_id" = ${space.id}`;
      }
      for (const b of budgets) {
        await tx.budget.update({ where: { id: b.id }, data: { amount: convert(b.amount) } });
      }
      for (const g of goals) {
        await tx.goal.update({
          where: { id: g.id },
          data: { targetAmount: convert(g.targetAmount), currentAmount: convert(g.currentAmount) },
        });
      }
      for (const d of debts) {
        await tx.debt.update({
          where: { id: d.id },
          data: { balance: convert(d.balance), minimumPayment: convert(d.minimumPayment) },
        });
      }
      await tx.household.update({ where: { id: space.id }, data: { currency: next } });
    },
    { timeout: 60_000 },
  );

  refresh();
  return { ok: true };
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Inserisci un'email valida").max(254),
});

export type InviteResult = ActionResult & { link?: string };

export async function inviteMember(input: unknown): Promise<InviteResult> {
  const space = await requireSpace();
  if (space.role !== "OWNER") return OWNER_ONLY;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { email } = parsed.data;

  const [members, alreadyIn] = await Promise.all([
    prisma.householdMember.count({ where: { householdId: space.id } }),
    prisma.householdMember.count({
      where: { householdId: space.id, user: { email: { equals: email, mode: "insensitive" } } },
    }),
  ]);
  if (alreadyIn) return { ok: false, fieldErrors: { email: ["Fa già parte dello spazio"] } };
  if (members >= MAX_MEMBERS) {
    return { ok: false, error: `Uno spazio può avere al massimo ${MAX_MEMBERS} persone.` };
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // A new invite to the same address replaces the previous one.
    prisma.householdInvite.deleteMany({ where: { householdId: space.id, email } }),
    prisma.householdInvite.create({
      data: {
        householdId: space.id,
        email,
        tokenHash: hashInviteToken(token),
        invitedById: space.user.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    }),
  ]);

  const link = `${getAppUrl()}/invite/${token}`;
  const inviter = space.user.name ?? space.user.email ?? "Qualcuno";
  try {
    await sendEmail({
      to: email,
      subject: `${inviter} ti ha invitato su FinTrack`,
      text: `${inviter} ti ha invitato a gestire insieme le finanze nello spazio «${space.name}» su FinTrack.\n\nAccetta l'invito (valido 7 giorni):\n${link}`,
      html: `<p>${escapeHtml(inviter)} ti ha invitato a gestire insieme le finanze nello spazio <strong>${escapeHtml(space.name)}</strong> su FinTrack.</p><p><a href="${escapeHtml(link)}">Accetta l'invito</a> (valido 7 giorni)</p>`,
    });
  } catch (error) {
    // The link is also shown to the owner, who can send it another way.
    console.error("[invite] invio email fallito", error);
  }

  revalidatePath("/settings");
  return { ok: true, link };
}

export async function revokeInvite(id: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (space.role !== "OWNER") return OWNER_ONLY;
  await prisma.householdInvite.deleteMany({ where: { id, householdId: space.id } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const space = await requireSpace();
  if (space.role !== "OWNER") return OWNER_ONLY;
  if (userId === space.user.id) return { ok: false, error: "Non puoi rimuovere te stesso." };
  // What they recorded stays in the space: it's shared history.
  await prisma.householdMember.deleteMany({
    where: { householdId: space.id, userId, role: "MEMBER" },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function leaveSpace(): Promise<ActionResult> {
  const space = await requireSpace();
  if (space.role === "OWNER") {
    return { ok: false, error: "Sei il proprietario: non puoi uscire dal tuo spazio." };
  }
  await prisma.$transaction([
    prisma.householdMember.delete({
      where: { householdId_userId: { householdId: space.id, userId: space.user.id } },
    }),
    prisma.user.update({ where: { id: space.user.id }, data: { activeHouseholdId: null } }),
  ]);
  refresh();
  return { ok: true };
}
