import type { Plan } from "@prisma/client";

/*
 * Plans: FREE has the whole app except the AI coach chat, which costs money per question; PRO
 * (Stripe subscription) adds it. Until Stripe is configured there's nothing to buy, so the AI
 * coach stays open to everyone (still limited per user).
 */

export const billingEnabled = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);

export function canUseAiCoach(user: { plan: Plan }) {
  return !billingEnabled() || user.plan === "PRO";
}

/** What Pro adds, for the pricing table and the upsell messages. */
export const PRO_FEATURES = [
  "Coach AI: chiedi qualsiasi cosa sui tuoi soldi, risponde con i tuoi numeri",
  "Fino a 30 domande al giorno al coach AI",
  "Sostieni lo sviluppo di FinTrack",
];
