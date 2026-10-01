import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

// Everything requires a session except the landing page ("/": the pattern needs at least one
// character), the auth and legal pages, the email links, NextAuth's API, the cron jobs, the
// Stripe webhook and static assets, so new pages are protected by default.
export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|verify-email|privacy|terms|api/auth|api/cron|api/billing/webhook|invite|api/digest/unsubscribe|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|apple-icon|opengraph-image).+)",
  ],
};
