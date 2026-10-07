/*
 * Who runs FinTrack, as shown in the privacy policy and the terms. Set LEGAL_OWNER (name, or
 * company and VAT number) and LEGAL_EMAIL in the environment before going public.
 */

export const LEGAL = {
  owner: process.env.LEGAL_OWNER || "il gestore di FinTrack",
  email: process.env.LEGAL_EMAIL || null,
  /** Shown at the top of both documents; update it with every change. */
  updatedAt: "7 ottobre 2026",
};
