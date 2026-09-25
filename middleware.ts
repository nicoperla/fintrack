import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

// Everything requires a session except the auth pages, NextAuth's API and static assets,
// so new pages are protected by default.
export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|api/auth|api/cron|api/digest/unsubscribe|_next/static|_next/image|favicon.ico).*)",
  ],
};
