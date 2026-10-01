import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { stripe, syncSubscription } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe → FinTrack: keeps each user's plan in sync with their subscription. Configure the
 * endpoint in Stripe with the events checkout.session.completed and customer.subscription.*.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook non configurato", { status: 400 });

  // The signature is computed on the raw body: read it as text, never re-serialize the JSON.
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return new Response("Firma non valida", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (session.client_reference_id && customerId) {
        await prisma.user.updateMany({
          where: { id: session.client_reference_id, stripeCustomerId: null },
          data: { stripeCustomerId: customerId },
        });
      }
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (subscriptionId) {
        await syncSubscription(await stripe().subscriptions.retrieve(subscriptionId));
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
  }
  return Response.json({ received: true });
}
