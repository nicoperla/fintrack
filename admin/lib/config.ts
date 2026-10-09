/*
 * The panel's environment. Only ADMIN_SECRET (and the database) are required; the rest turns
 * features on: Stripe for subscriptions and payments, Resend for emails to users.
 */

export const MIN_SECRET_LENGTH = 32;

export function adminSecret() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`ADMIN_SECRET mancante o più corta di ${MIN_SECRET_LENGTH} caratteri`);
  }
  return secret;
}

export const secretConfigured = () => (process.env.ADMIN_SECRET?.length ?? 0) >= MIN_SECRET_LENGTH;

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

export const emailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && fintrackUrl());

/** FinTrack's public address, for links in emails to users. */
export function fintrackUrl() {
  const url = process.env.FINTRACK_URL?.replace(/\/$/, "");
  return url && /^https?:\/\//.test(url) ? url : null;
}

/** IPs allowed to open the panel; empty: everyone (the login still applies). */
export function allowedIps() {
  return (process.env.ADMIN_ALLOWED_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

/** HTTPS in production: the session cookie gets the __Host- prefix. */
export const secureCookies = () => process.env.NODE_ENV === "production";
