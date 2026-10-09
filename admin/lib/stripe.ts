import Stripe from "stripe";
import { prisma } from "@/lib/db";

/*
 * Stripe from the panel: read subscriptions and invoices, cancel or resume. FinTrack's webhook
 * keeps users.plan in sync anyway; the panel also writes the result right away so the page
 * shows it without waiting.
 */

let client: Stripe | null = null;

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY non configurata");
  return (client ??= new Stripe(key));
}

export const stripeTestMode = () => process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") ?? false;

/** A page of the Stripe dashboard, in test mode when the key is a test key. */
export function dashboardUrl(path: string) {
  return `https://dashboard.stripe.com${stripeTestMode() ? "/test" : ""}/${path.replace(/^\//, "")}`;
}

/** As in FinTrack: these statuses keep Pro (past_due gets Stripe's retry period first). */
const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

export function planFromSubscription(subscription: Stripe.Subscription) {
  const periodEnd = subscription.items.data[0]?.current_period_end ?? null;
  return {
    plan: PRO_STATUSES.has(subscription.status) ? ("PRO" as const) : ("FREE" as const),
    subscriptionStatus: subscription.status,
    planRenewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
    planCancelsAtEnd: subscription.cancel_at_period_end || subscription.cancel_at !== null,
  };
}

export async function applySubscription(userId: string, subscription: Stripe.Subscription) {
  await prisma.user.update({ where: { id: userId }, data: planFromSubscription(subscription) });
}

/** The customer's subscriptions, newest first. */
export async function customerSubscriptions(customerId: string) {
  const { data } = await stripe().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });
  return data;
}

/** Monthly amount of a subscription, in its currency (yearly prices divided by 12). */
export function monthlyAmount(subscription: Stripe.Subscription) {
  return subscription.items.data.reduce((sum, item) => {
    const price = item.price;
    const unit = (price.unit_amount ?? 0) / 100;
    const count = price.recurring?.interval_count ?? 1;
    const perMonth =
      price.recurring?.interval === "year"
        ? unit / (12 * count)
        : price.recurring?.interval === "week"
          ? (unit * 52) / (12 * count)
          : price.recurring?.interval === "day"
            ? (unit * 365) / (12 * count)
            : unit / count;
    return sum + perMonth * (item.quantity ?? 1);
  }, 0);
}

/** Monthly recurring revenue from the active and trialing subscriptions (first 100). */
export async function recurringRevenue() {
  const subscriptions: Stripe.Subscription[] = [];
  for (const status of ["active", "trialing", "past_due"] as const) {
    const { data } = await stripe().subscriptions.list({ status, limit: 100 });
    subscriptions.push(...data);
  }
  const paying = subscriptions.filter((s) => s.status !== "trialing");
  const mrr = paying.reduce((sum, s) => sum + monthlyAmount(s), 0);
  const currency = subscriptions[0]?.currency.toUpperCase() ?? "EUR";
  return { mrr, currency, subscriptions };
}
