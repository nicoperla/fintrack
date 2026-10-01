import type { Plan } from "@prisma/client";

/*
 * Plans: FREE has the whole app, with the totals of "Soldi ritrovati"; PRO (Stripe subscription)
 * adds the AI coach chat and the details of "Soldi ritrovati" (which expenses, the 730 dossier,
 * cancellation letters). Until Stripe is configured there's nothing to buy, so everyone gets
 * everything (the AI coach still limited per user).
 */

export const billingEnabled = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);

export function hasPro(user: { plan: Plan }) {
  return !billingEnabled() || user.plan === "PRO";
}

export const canUseAiCoach = hasPro;

/** What Pro adds, for the pricing table and the upsell messages. */
export const PRO_FEATURES = [
  "Soldi ritrovati: le spese detraibili una per una, il dossier 730 in PDF e le lettere di disdetta",
  "Coach AI: chiedi qualsiasi cosa sui tuoi soldi, risponde con i tuoi numeri",
  "Fino a 30 domande al giorno al coach AI",
];
