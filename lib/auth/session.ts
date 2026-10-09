import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/prisma";
import { getActiveSpace, type ActiveSpace } from "@/lib/households";

// JWT sessions can't be deleted, so they're checked against the account on every request: a
// deleted or suspended user, or a session older than the last password change, 2FA change or
// "sign out everywhere" (they raise sessionVersion), counts as logged out.
// cache() dedupes the lookup across the layout, page and actions of a single request.
export const getSession = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { sessionVersion: true, suspendedAt: true },
  });
  return user && !user.suspendedAt && user.sessionVersion === (session.sv ?? 0) ? session : null;
});

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

export type Space = ActiveSpace & {
  user: { id: string; name?: string | null; email?: string | null };
};

/** The current user's active space. Everything financial must go through `space.id`. */
export const requireSpace = cache(async (): Promise<Space> => {
  const user = await requireUser();
  return { ...(await getActiveSpace(user)), user };
});
