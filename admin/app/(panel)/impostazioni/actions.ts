"use server";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { done, fail, type ActionResult } from "@/lib/action";
import { requireAdmin, startSession } from "@/lib/auth/session";
import { confirmAdmin } from "@/lib/auth/step-up";
import {
  adminPasswordProblem,
  generateRecoveryCodes,
  hashPassword,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "@/lib/auth/secrets";

/*
 * The admin's own account. Changing the password and "sign out everywhere" raise the session
 * version (every other session ends) and sign this browser in again. No revalidatePath here:
 * the new cookie already makes Next.js render the page again.
 */

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function changeAdminPassword(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const password = text(form, "password");
  const denied = await confirmAdmin(admin.id, {
    password: text(form, "current"),
    code: text(form, "code"),
  });
  if (denied) return fail(denied);
  const problem = adminPasswordProblem(password, admin.email);
  if (problem) return fail(`Nuova password: ${problem.toLowerCase()}.`);
  if (password !== text(form, "confirm")) return fail("Le nuove password non coincidono.");

  const updated = await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } },
  });
  await startSession(admin.id, updated.sessionVersion);
  await audit(admin.id, "admin.password_changed");
  return done("Password cambiata. Le altre sessioni sono state chiuse.");
}

export async function regenerateAdminCodes(form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const denied = await confirmAdmin(admin.id, {
    password: text(form, "password"),
    code: text(form, "code"),
  });
  if (denied) return fail(denied);
  const codes = generateRecoveryCodes();
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { recoveryCodes: codes.map((code) => hashRecoveryCode(normalizeRecoveryCode(code)!)) },
  });
  await audit(admin.id, "admin.recovery_regenerated");
  return { ok: true, codes };
}

export async function signOutAdminEverywhere(): Promise<ActionResult> {
  const admin = await requireAdmin();
  const updated = await prisma.adminUser.update({
    where: { id: admin.id },
    data: { sessionVersion: { increment: 1 } },
  });
  await startSession(admin.id, updated.sessionVersion);
  await audit(admin.id, "admin.sessions_revoked");
  return done("Sei connesso solo da qui.");
}
