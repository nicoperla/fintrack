import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

// Everything requires a session except the landing page ("/": the pattern needs at least one
// character), the auth and legal pages, the email links, the family file shared with a trusted
// person (its token is the key), NextAuth's API, the cron jobs, the Stripe webhook and static
// assets (landing/: the landing page media), so new pages are protected by default.
export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|verify-email|privacy|terms|api/auth|api/cron|api/billing/webhook|invite|fascicolo/condiviso/|patto/arbitro/|api/digest/unsubscribe|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|landing/|apple-icon|opengraph-image).+)",
  ],
};
