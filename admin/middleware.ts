import { NextResponse, type NextRequest } from "next/server";
import { allowedIps, secretConfigured, secureCookies } from "@/lib/config";
import { ipFrom } from "@/lib/request";
import { sessionCookieName, verifySession } from "@/lib/auth/session-token";

/** Pages reachable without a session (the setup page closes itself once an admin exists). */
const PUBLIC = ["/login", "/setup"];

export async function middleware(req: NextRequest) {
  // With ADMIN_ALLOWED_IPS set, any other IP gets a plain 404: the panel doesn't even show.
  const allowed = allowedIps();
  if (allowed.length > 0 && !allowed.includes(ipFrom(req.headers))) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!secretConfigured()) {
    return new NextResponse("ADMIN_SECRET non configurata (almeno 32 caratteri).", {
      status: 503,
    });
  }

  const { pathname } = req.nextUrl;
  if (PUBLIC.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }
  // A first check here (signature and expiry); the pages also check the version in the database.
  const token = req.cookies.get(sessionCookieName(secureCookies()))?.value;
  if (!(await verifySession(process.env.ADMIN_SECRET!, token))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
