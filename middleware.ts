import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/accounts/:path*",
    "/categories/:path*",
    "/budgets/:path*",
    "/goals/:path*",
    "/insights/:path*",
    "/settings/:path*",
  ],
};
