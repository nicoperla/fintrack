"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { done, fail, type ActionResult } from "@/lib/action";
import { emailConfigured, fintrackUrl, stripeConfigured } from "@/lib/config";
import { escapeHtml, sendEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/auth/session";
import { confirmAdmin } from "@/lib/auth/step-up";
import { applySubscription, customerSubscriptions, stripe } from "@/lib/stripe";

/*
 * What the panel can do to a FinTrack account. Each action is logged with the admin, the user
 * and the IP. FinTrack checks suspensions and session versions on every request, so blocking
 * someone or closing their sessions takes effect on their next click.
 */

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

async function load(userId: string) {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      suspendedAt: true,
      twoFactorEnabledAt: true,
      emailVerifiedAt: true,
    },
  });
  return { admin, user };
}

const refresh = (userId: string) => revalidatePath(`/utenti/${userId}`);

/** Ends every FinTrack session of the user and any half-done sign-in. */
const signOutEverywhere = (userId: string) => [
  prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } }),
  prisma.loginTicket.deleteMany({ where: { userId } }),
];

export async function suspendUser(userId: string, form: FormData): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  const reason = text(form, "reason").slice(0, 300);
  if (!reason) return fail("Scrivi il motivo: resta nel registro.");
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: new Date(), suspendedReason: reason },
    }),
    ...signOutEverywhere(userId),
  ]);
  await audit(admin.id, "user.suspended", { target: user, details: { reason } });
  refresh(userId);
  return done("Utente sospeso: è stato disconnesso e non può più entrare.");
}

export async function reactivateUser(userId: string): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: null, suspendedReason: null },
  });
  await audit(admin.id, "user.reactivated", { target: user });
  refresh(userId);
  return done("Utente riattivato.");
}

export async function revokeUserSessions(userId: string): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  await prisma.$transaction(signOutEverywhere(userId));
  await audit(admin.id, "user.sessions_revoked", { target: user });
  refresh(userId);
  return done("Sessioni chiuse: l'utente dovrà accedere di nuovo.");
}

/** For who lost both the phone and the recovery codes: after checking it's really them. */
export async function resetUserTwoFactor(userId: string, form: FormData): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  if (!user.twoFactorEnabledAt) return fail("L'utente non ha la verifica in due passaggi.");
  const denied = await confirmAdmin(admin.id, { code: text(form, "code") });
  if (denied) return fail(denied);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, twoFactorEnabledAt: null, totpLastStep: null },
    }),
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    ...signOutEverywhere(userId),
  ]);
  await audit(admin.id, "user.two_factor_reset", { target: user });
  if (emailConfigured()) {
    await sendEmail({
      to: user.email,
      subject: "Verifica in due passaggi disattivata dall'assistenza",
      text: `Su tua richiesta l'assistenza di FinTrack ha disattivato la verifica in due passaggi del tuo account. Accedi con la password e riattivala da Impostazioni › Sicurezza.\n\nSe non l'hai chiesto tu, rispondi subito a questa email.`,
      html: `<p>Su tua richiesta l'assistenza di FinTrack ha disattivato la verifica in due passaggi del tuo account. Accedi con la password e riattivala da <a href="${fintrackUrl()}/settings#sicurezza">Impostazioni › Sicurezza</a>.</p><p>Se non l'hai chiesto tu, rispondi subito a questa email.</p>`,
    }).catch((error) => console.error("[admin] email 2FA non inviata", error));
  }
  refresh(userId);
  return done("Verifica in due passaggi azzerata e sessioni chiuse.");
}

export async function verifyUserEmail(userId: string): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  if (user.emailVerifiedAt) return done("L'email era già confermata.");
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
  ]);
  await audit(admin.id, "user.email_verified", { target: user });
  refresh(userId);
  return done("Email confermata.");
}

/** The same reset link FinTrack sends from "Password dimenticata?" (valid 1 hour). */
export async function sendUserPasswordReset(userId: string): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  if (!emailConfigured()) {
    return fail(
      "Le email non sono configurate nel pannello (RESEND_API_KEY, EMAIL_FROM, FINTRACK_URL).",
    );
  }
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.create({
      data: {
        userId,
        // As in FinTrack: only the SHA-256 of the token is stored.
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    }),
  ]);
  const link = `${fintrackUrl()}/reset-password?token=${token}`;
  const hello = user.name ? `Ciao ${user.name.split(" ")[0]},` : "Ciao,";
  try {
    await sendEmail({
      to: user.email,
      subject: "Reimposta la tua password FinTrack",
      text: `${hello}\n\nper reimpostare la password apri questo link (valido 1 ora):\n${link}\n\nSe non l'hai chiesto tu, ignora questa email.`,
      html: `<p>${escapeHtml(hello)}</p><p>per reimpostare la password clicca qui (valido 1 ora):</p><p><a href="${link}">Reimposta password</a></p><p>Se non l'hai chiesto tu, ignora questa email.</p>`,
    });
  } catch (error) {
    console.error("[admin] email di reset non inviata", error);
    return fail("Invio non riuscito. Riprova tra poco.");
  }
  await audit(admin.id, "user.password_reset_sent", { target: user });
  return done(`Link di reset inviato a ${user.email}.`);
}

const PAYING = new Set(["active", "trialing", "past_due"]);

/** Pro without paying, until a date ("comp"); FinTrack's nightly job ends it on time. */
export async function grantPro(userId: string, form: FormData): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  if (user.subscriptionStatus && PAYING.has(user.subscriptionStatus)) {
    return fail("Ha già un abbonamento Stripe: gestiscilo da lì.");
  }
  const days = Number.parseInt(text(form, "days"), 10);
  if (!Number.isFinite(days) || days < 1 || days > 730) return fail("Da 1 a 730 giorni.");
  const until = new Date(Date.now() + days * 86_400_000);
  await prisma.user.update({
    where: { id: userId },
    data: { plan: "PRO", subscriptionStatus: "comp", planRenewsAt: until, planCancelsAtEnd: false },
  });
  await audit(admin.id, "user.pro_granted", {
    target: user,
    details: { days, until: until.toISOString() },
  });
  refresh(userId);
  return done(`Pro in omaggio per ${days} giorni.`);
}

export async function revokePro(userId: string): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  if (user.subscriptionStatus !== "comp") return fail("Non ha Pro in omaggio.");
  await prisma.user.update({
    where: { id: userId },
    data: { plan: "FREE", subscriptionStatus: null, planRenewsAt: null, planCancelsAtEnd: false },
  });
  await audit(admin.id, "user.pro_revoked", { target: user });
  refresh(userId);
  return done("Pro in omaggio tolto.");
}

export async function cancelSubscription(userId: string, form: FormData): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  if (!stripeConfigured() || !user.stripeCustomerId) return fail("Nessun cliente Stripe.");
  const now = text(form, "mode") === "now";
  const live = (await customerSubscriptions(user.stripeCustomerId)).filter((s) =>
    PAYING.has(s.status),
  );
  if (live.length === 0) return fail("Nessun abbonamento attivo su Stripe.");
  for (const subscription of live) {
    const updated = now
      ? await stripe().subscriptions.cancel(subscription.id)
      : await stripe().subscriptions.update(subscription.id, { cancel_at_period_end: true });
    await applySubscription(userId, updated);
  }
  await audit(admin.id, "user.subscription_canceled", {
    target: user,
    details: { immediately: now, subscriptions: live.map((s) => s.id) },
  });
  refresh(userId);
  return done(now ? "Abbonamento chiuso subito." : "Abbonamento disdetto a fine periodo.");
}

export async function resumeSubscription(userId: string): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  if (!stripeConfigured() || !user.stripeCustomerId) return fail("Nessun cliente Stripe.");
  const pending = (await customerSubscriptions(user.stripeCustomerId)).filter(
    (s) => PAYING.has(s.status) && s.cancel_at_period_end,
  );
  if (pending.length === 0) return fail("Nessuna disdetta da annullare.");
  for (const subscription of pending) {
    await applySubscription(
      userId,
      await stripe().subscriptions.update(subscription.id, { cancel_at_period_end: false }),
    );
  }
  await audit(admin.id, "user.subscription_resumed", { target: user });
  refresh(userId);
  return done("Disdetta annullata: l'abbonamento si rinnova.");
}

export async function addNote(userId: string, form: FormData): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  const note = text(form, "text").slice(0, 2000);
  if (!note) return fail("Scrivi la nota.");
  await prisma.adminNote.create({ data: { userId, adminId: admin.id, text: note } });
  await audit(admin.id, "user.note_added", { target: user });
  refresh(userId);
  return done("Nota salvata.");
}

export async function deleteNote(userId: string, noteId: string): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  const { count } = await prisma.adminNote.deleteMany({ where: { id: noteId, userId } });
  if (count === 0) return fail("Nota non trovata.");
  await audit(admin.id, "user.note_deleted", { target: user });
  refresh(userId);
  return done("Nota eliminata.");
}

/**
 * Deletes the account as FinTrack does when the user asks (settings/account-actions.ts there):
 * Stripe stopped first, shared spaces passed to their longest-standing member, the rest deleted.
 */
export async function deleteUser(userId: string, form: FormData): Promise<ActionResult> {
  const { admin, user } = await load(userId);
  if (!user) return fail("Utente non trovato.");
  if (text(form, "confirm").toLowerCase() !== user.email.toLowerCase()) {
    return fail("Scrivi l'email dell'utente per confermare.");
  }
  const denied = await confirmAdmin(admin.id, { code: text(form, "code") });
  if (denied) return fail(denied);

  if (user.stripeCustomerId && stripeConfigured()) {
    try {
      for (const subscription of await customerSubscriptions(user.stripeCustomerId)) {
        if (subscription.status !== "canceled" && subscription.status !== "incomplete_expired") {
          await stripe().subscriptions.cancel(subscription.id);
        }
      }
    } catch (error) {
      console.error("[admin] disdetta Stripe fallita", error);
      return fail("Non riesco a disdire l'abbonamento su Stripe: riprova o fallo da Stripe.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const owned = await tx.household.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        members: {
          where: { userId: { not: userId } },
          orderBy: { joinedAt: "asc" },
          take: 1,
          select: { userId: true },
        },
      },
    });
    for (const household of owned) {
      const heir = household.members[0];
      if (!heir) continue;
      await tx.household.update({ where: { id: household.id }, data: { ownerId: heir.userId } });
      await tx.householdMember.update({
        where: { householdId_userId: { householdId: household.id, userId: heir.userId } },
        data: { role: "OWNER" },
      });
    }
    await tx.claim.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
  await audit(admin.id, "user.deleted", { target: user });
  redirect("/utenti?deleted=1");
}
