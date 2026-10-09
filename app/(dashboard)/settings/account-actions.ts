"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { checkSecondFactor } from "@/lib/auth/two-factor";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { cancelCustomerSubscriptions } from "@/lib/billing/stripe";
import { formatRetryAfter, rateLimit, RULES } from "@/lib/rate-limit";
import { type ActionResult, validationError } from "@/lib/action-result";

export async function resendVerificationEmail(): Promise<ActionResult> {
  const session = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (user.emailVerifiedAt) return { ok: true };

  const limit = await rateLimit(`verify-resend:${user.id}`, RULES.verifyResend);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Hai già chiesto diversi link: riprova tra ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    };
  }
  try {
    await sendVerificationEmail(user);
  } catch (error) {
    console.error("[verify] invio email fallito", error);
    return { ok: false, error: "Invio non riuscito. Riprova tra poco." };
  }
  return { ok: true };
}

const deleteSchema = z.object({
  password: z.string().min(1, "Inserisci la password").max(72),
  confirm: z.string().refine((v) => v.trim().toUpperCase() === "ELIMINA", {
    message: "Scrivi ELIMINA per confermare",
  }),
  /** Required when 2FA is on. */
  code: z.string().trim().max(20).optional(),
});

/**
 * Deletes the account and everything that only belongs to it. Shared spaces the user owns go to
 * the longest-standing other member, so nobody else loses their data.
 */
export async function deleteAccount(input: unknown): Promise<ActionResult> {
  const session = await requireUser();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: {
      id: true,
      passwordHash: true,
      stripeCustomerId: true,
      twoFactorEnabledAt: true,
      totpSecret: true,
      totpLastStep: true,
    },
  });
  // Its own limit: a session left open is not a way to guess the password.
  const limit = await rateLimit(`reauth:${user.id}`, RULES.reauth);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Troppi tentativi: riprova tra ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    };
  }
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { ok: false, fieldErrors: { password: ["Password non corretta"] } };
  }
  if (user.twoFactorEnabledAt) {
    if (!parsed.data.code) return { ok: false, fieldErrors: { code: ["Inserisci il codice"] } };
    const check = await checkSecondFactor(user, parsed.data.code);
    if (!check.ok) {
      return check.error === "RATE_LIMITED"
        ? {
            ok: false,
            error: `Troppi codici sbagliati: riprova tra ${formatRetryAfter(check.retryAfterSeconds)}.`,
          }
        : { ok: false, fieldErrors: { code: ["Codice non valido"] } };
    }
  }

  // Stop the subscription first: once the account is gone nobody could cancel it.
  if (user.stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
    try {
      await cancelCustomerSubscriptions(user.stripeCustomerId);
    } catch (error) {
      console.error("[delete-account] disdetta Stripe fallita", error);
      return {
        ok: false,
        error:
          "Non sono riuscito a disdire l'abbonamento. Riprova tra poco o disdicilo da Abbonamento.",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    const owned = await tx.household.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        members: {
          where: { userId: { not: user.id } },
          orderBy: { joinedAt: "asc" },
          take: 1,
          select: { userId: true },
        },
      },
    });
    for (const household of owned) {
      const heir = household.members[0];
      if (!heir) continue; // Only the user in it: it goes with the account.
      await tx.household.update({ where: { id: household.id }, data: { ownerId: heir.userId } });
      await tx.householdMember.update({
        where: { householdId_userId: { householdId: household.id, userId: heir.userId } },
        data: { role: "OWNER" },
      });
    }
    // "Riprenditeli" letters are written in the user's name: unlike the other records of a
    // shared space, they leave with the account.
    await tx.claim.deleteMany({ where: { userId: user.id } });
    // Cascades to memberships, tokens and the spaces still owned; records in shared spaces
    // stay there with no author.
    await tx.user.delete({ where: { id: user.id } });
  });

  return { ok: true };
}
