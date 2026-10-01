import Stripe from "stripe";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";

/*
 * FinTrack Pro on Stripe: Checkout for subscribing, the Customer Portal for managing and
 * cancelling, webhooks to keep `users.plan` in sync. Card data never touches our servers.
 */

let client: Stripe | null = null;

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY non configurata");
  return (client ??= new Stripe(key));
}

/** Statuses that keep Pro: a failed renewal (past_due) gets Stripe's retry period first. */
const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

type SubscriptionLike = Pick<
  Stripe.Subscription,
  "status" | "cancel_at_period_end" | "cancel_at"
> & {
  items: { data: { current_period_end?: number | null }[] };
};

/** The user's plan fields for a subscription. */
export function planFromSubscription(subscription: SubscriptionLike) {
  const periodEnd = subscription.items.data[0]?.current_period_end ?? null;
  return {
    plan: PRO_STATUSES.has(subscription.status) ? ("PRO" as const) : ("FREE" as const),
    subscriptionStatus: subscription.status,
    planRenewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
    planCancelsAtEnd: subscription.cancel_at_period_end || subscription.cancel_at !== null,
  };
}

/** Applies a subscription to the user it belongs to (by Stripe customer, else by metadata). */
export async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId = subscription.metadata?.userId;
  const user =
    (await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    })) ??
    (userId ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }) : null);
  if (!user) {
    console.warn(`[billing] nessun utente per il cliente Stripe ${customerId}`);
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customerId, ...planFromSubscription(subscription) },
  });
}

/** Account deletion: stop charging immediately. */
export async function cancelCustomerSubscriptions(customerId: string) {
  const subscriptions = await stripe().subscriptions.list({ customer: customerId, status: "all" });
  for (const subscription of subscriptions.data) {
    if (subscription.status !== "canceled" && subscription.status !== "incomplete_expired") {
      await stripe().subscriptions.cancel(subscription.id);
    }
  }
}

export type ProPrice = { amount: number; currency: string; interval: string };

/** The Pro price as configured in Stripe, cached for an hour (shown on the landing page). */
export const getProPrice = unstable_cache(
  async (): Promise<ProPrice | null> => {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!process.env.STRIPE_SECRET_KEY || !priceId) return null;
    try {
      const price = await stripe().prices.retrieve(priceId);
      if (price.unit_amount === null) return null;
      return {
        amount: price.unit_amount / 100,
        currency: price.currency.toUpperCase(),
        interval: price.recurring?.interval ?? "month",
      };
    } catch (error) {
      console.error("[billing] prezzo non disponibile", error);
      return null;
    }
  },
  ["pro-price"],
  { revalidate: 3600 },
);

/** Back from Checkout: sync right away instead of waiting for the webhook. */
export async function refreshSubscription(customerId: string) {
  const { data } = await stripe().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 1,
  });
  if (data[0]) await syncSubscription(data[0]);
}
