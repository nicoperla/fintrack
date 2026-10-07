import type { Plan } from "@prisma/client";

/*
 * Plans: FREE has the whole app, with the totals of "Soldi ritrovati" and one "Riprenditeli"
 * claim open at a time; PRO (Stripe subscription) adds the AI coach chat, the details of "Soldi
 * ritrovati" (which expenses, the 730 dossier), unlimited claims and their letters in PDF. Until
 * Stripe is configured there's nothing to buy, so everyone gets everything (the AI coach still
 * limited per user).
 */

export const billingEnabled = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);

export function hasPro(user: { plan: Plan }) {
  return !billingEnabled() || user.plan === "PRO";
}

export const canUseAiCoach = hasPro;

/** "Riprenditeli" on the free plan: claims in progress (draft or sent) at the same time. */
export const FREE_OPEN_CLAIMS = 1;

/** What Pro adds, for the pricing table and the upsell messages. */
export const PRO_FEATURES = [
  "Soldi ritrovati: le spese detraibili una per una, il dossier 730 in PDF e le lettere di disdetta",
  "Riprenditeli: tutte le pratiche che vuoi per riavere i tuoi soldi, con le lettere in PDF per la raccomandata",
  "Coach AI: chiedi qualsiasi cosa sui tuoi soldi, risponde con i tuoi numeri",
  "Fino a 30 domande al giorno al coach AI",
];
