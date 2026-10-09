"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { clientIp } from "@/lib/request";
import { rateLimit, RULES, waitText } from "@/lib/rate-limit";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/secrets";
import { checkAdminCode } from "@/lib/auth/second-factor";
import { endSession, getAdmin, startSession } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().trim().toLowerCase().max(200),
  password: z.string().min(1).max(72),
  code: z.string().trim().min(6).max(20),
});

/** Same answer for every failure: wrong email, password or code. */
const WRONG = "Credenziali o codice non validi.";

export async function login(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("Inserisci email, password e codice.");
  const { email, password, code } = parsed.data;

  // Before anything else, so guessing is slow whatever the outcome.
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`login:ip:${await clientIp()}`, RULES.loginIp),
    rateLimit(`login:email:${email}`, RULES.loginEmail),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    const wait = Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds);
    return fail(`Troppi tentativi. Riprova tra ${waitText(wait)}.`);
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  // The password is always compared (against a dummy hash too), so timing tells nothing.
  const passwordOk = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);
  const ok = Boolean(admin?.activatedAt) && passwordOk && (await checkAdminCode(admin!, code));
  if (!ok || !admin) {
    await audit(admin?.activatedAt ? admin.id : null, "admin.login_failed", {
      details: { email },
    });
    return fail(WRONG);
  }

  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await startSession(admin.id, admin.sessionVersion);
  await audit(admin.id, "admin.login");
  redirect("/");
}

export async function logout() {
  const admin = await getAdmin();
  if (admin) await audit(admin.id, "admin.logout");
  await endSession();
  redirect("/login");
}
