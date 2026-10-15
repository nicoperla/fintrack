import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import {
  deviceCookieName,
  deviceCookieOptions,
  isDeviceId,
  newDeviceId,
} from "@/lib/auth/device-cookie";
import { needsSession } from "@/lib/auth/public-paths";
import { GATE_COOKIE, GATE_PAGE, gateEnabled, isOpenPath, validPass } from "@/lib/gate";

const withSession = withAuth(
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

const CLOSED_HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Without the pass: people go to the page that asks for the code, scripts get a plain no. */
function closed(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/") || (req.method !== "GET" && req.method !== "HEAD")) {
    return new NextResponse("Accesso riservato", { status: 401, headers: CLOSED_HEADERS });
  }
  const url = req.nextUrl.clone();
  url.pathname = GATE_PAGE;
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  const res = NextResponse.redirect(url);
  for (const [name, value] of Object.entries(CLOSED_HEADERS)) res.headers.set(name, value);
  return res;
}

/**
 * Every request goes through here. First the pre-launch gate (lib/gate.ts): without a valid
 * pass, nothing but the gate itself is served. Then, for the app's pages, the session.
 */
export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  if (gateEnabled() && !isOpenPath(pathname)) {
    let allowed = false;
    try {
      allowed = await validPass(req.cookies.get(GATE_COOKIE)?.value);
    } catch (error) {
      // A configuration problem keeps the site closed, never open.
      console.error("[gate]", error);
    }
    if (!allowed) return closed(req);
  }
  if (needsSession(pathname)) return withSession(req as NextRequestWithAuth, event);
  return NextResponse.next();
}

// Everything, the root and the files in public/ included, except the build's own JS and CSS
// (the gate page needs them; they hold code, never data) and the old favicon path.
export const config = {
  matcher: ["/((?!_next/static/|favicon.ico).*)"],
};
