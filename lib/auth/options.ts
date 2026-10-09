import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { deviceIdFromCookieHeader } from "@/lib/auth/devices";
import { isTicket, redeemTicket } from "@/lib/auth/login-ticket";

const ticketLogin = z.object({
  ticket: z.string().refine(isTicket),
  code: z.string().trim().max(20).optional(),
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "FinTrack",
      // No password here: the sign-in server action checked it and issued the ticket
      // (lib/auth/login-ticket.ts). This step only adds the 2FA code, when it's on.
      credentials: {
        ticket: { label: "Ticket", type: "text" },
        code: { label: "Codice", type: "text" },
      },
      async authorize(credentials, req) {
        const parsed = ticketLogin.safeParse(credentials);
        if (!parsed.success) return null;
        const cookie = req?.headers?.cookie;
        const result = await redeemTicket({
          token: parsed.data.ticket,
          code: parsed.data.code || undefined,
          deviceId: deviceIdFromCookieHeader(typeof cookie === "string" ? cookie : undefined),
        });
        if (!result.ok) throw new Error(result.error);
        return result.user;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sv = user.sessionVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id;
      session.sv = token.sv ?? 0;
      return session;
    },
  },
};
