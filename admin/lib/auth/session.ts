import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { adminSecret, secureCookies } from "@/lib/config";
import { SESSION_HOURS, sessionCookieName, signSession, verifySession } from "./session-token";

export type Admin = { id: string; email: string; name: string };

/** The signed-in admin, or null. Checked against the database on every request. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const token = (await cookies()).get(sessionCookieName(secureCookies()))?.value;
  const payload = await verifySession(adminSecret(), token);
  if (!payload) return null;
  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.a },
    select: { id: true, email: true, name: true, sessionVersion: true, activatedAt: true },
  });
  if (!admin?.activatedAt || admin.sessionVersion !== payload.v) return null;
  return { id: admin.id, email: admin.email, name: admin.name };
});

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return admin;
}

/** Signs this browser in (server actions only: it sets a cookie). */
export async function startSession(adminId: string, version: number) {
  (await cookies()).set(
    sessionCookieName(secureCookies()),
    await signSession(adminSecret(), adminId, version),
    {
      httpOnly: true,
      secure: secureCookies(),
      // Strict: the cookie is never sent when arriving from another site.
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_HOURS * 3600,
    },
  );
}

export async function endSession() {
  (await cookies()).delete(sessionCookieName(secureCookies()));
}
