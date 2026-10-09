"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getAppUrl } from "@/lib/app-url";
import { billingEnabled } from "@/lib/billing/plan";
import { stripe } from "@/lib/billing/stripe";
import type { ActionResult } from "@/lib/action-result";

const NOT_AVAILABLE: ActionResult = {
  ok: false,
  error: "I pagamenti non sono ancora attivi. Riprova più tardi.",
};

const USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  plan: true,
  subscriptionStatus: true,
  stripeCustomerId: true,
} as const;

async function customerFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: USER_FIELDS,
  });
  if (user.stripeCustomerId) return user;
  const customer = await stripe().customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });
  return prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
    select: USER_FIELDS,
  });
}

/** Sends the user to Stripe Checkout for FinTrack Pro (or to the portal if already Pro). */
export async function startCheckout(): Promise<ActionResult> {
  const session = await requireUser();
  if (!billingEnabled()) return NOT_AVAILABLE;
  const user = await customerFor(session.id);
  // Pro given from the admin panel ("comp") can still subscribe, to keep it after the gift.
  if (user.plan === "PRO" && user.subscriptionStatus !== "comp") return openBillingPortal();

  const base = getAppUrl();
  const checkout = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: user.stripeCustomerId!,
    client_reference_id: user.id,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: { metadata: { userId: user.id } },
    allow_promotion_codes: true,
    locale: "it",
    success_url: `${base}/settings?billing=success#abbonamento`,
    cancel_url: `${base}/settings?billing=cancel#abbonamento`,
  });
  if (!checkout.url) return { ok: false, error: "Pagamento non disponibile. Riprova." };
  redirect(checkout.url);
}

/** Stripe's Customer Portal: change card, see invoices, cancel. */
export async function openBillingPortal(): Promise<ActionResult> {
  const session = await requireUser();
  if (!billingEnabled()) return NOT_AVAILABLE;
  const user = await customerFor(session.id);
  const portal = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId!,
    return_url: `${getAppUrl()}/settings#abbonamento`,
    locale: "it",
  });
  redirect(portal.url);
}
