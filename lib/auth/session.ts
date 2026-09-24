import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/prisma";

// JWT sessions outlive deleted users: treat a token whose user no longer exists as logged out.
// cache() dedupes the lookup across the layout, page and actions of a single request.
export const getSession = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  return user ? session : null;
});

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}
