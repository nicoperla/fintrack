import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    /** The account's session version when this session started (see lib/auth/session.ts). */
    sv: number;
  }

  interface User {
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    /** Missing in sessions started before session versions existed: read as 0. */
    sv?: number;
  }
}
