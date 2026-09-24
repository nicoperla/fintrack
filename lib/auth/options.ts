import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validations/auth";

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = "$2b$12$GNMrHoKeK2LNEa.gtMgSDOro/8YpSF.ZdEXbGrUIb/RF3mSVayrhe";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email e password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id;
      return session;
    },
  },
};
