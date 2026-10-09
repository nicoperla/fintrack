import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import {
  deviceCookieName,
  deviceCookieOptions,
  isDeviceId,
  newDeviceId,
} from "@/lib/auth/device-cookie";

export default withAuth(
  // Signed-in browsers always carry the device cookie, so the security settings never have to
  // set it in a server action (see currentDevice in lib/auth/login-ticket.ts). Sessions opened
  // before the cookie existed get one on their next page.
  function middleware(req) {
    const res = NextResponse.next();
    if (!isDeviceId(req.cookies.get(deviceCookieName())?.value)) {
      res.cookies.set(deviceCookieName(), newDeviceId(), deviceCookieOptions());
    }
    return res;
  },
  { pages: { signIn: "/login" } },
);

// Everything requires a session except the landing page ("/": the pattern needs at least one
// character), the auth and legal pages, the email links, the family file shared with a trusted
// person (its token is the key), NextAuth's API, the cron jobs, the Stripe webhook and static
// assets (landing/: the landing page media), so new pages are protected by default.
export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|verify-email|privacy|terms|api/auth|api/cron|api/billing/webhook|invite|fascicolo/condiviso/|patto/arbitro/|api/digest/unsubscribe|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|landing/|apple-icon|opengraph-image).+)",
  ],
};
