import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/request";

/*
 * The audit log: every action in the panel, with who, on whom, when and from which IP. Shown
 * in "Registro" and on each user's page; FinTrack's nightly cleanup keeps one year.
 */

export const ACTIONS = {
  "admin.setup": "Pannello configurato",
  "admin.login": "Accesso al pannello",
  "admin.login_failed": "Accesso al pannello rifiutato",
  "admin.logout": "Uscita dal pannello",
  "admin.password_changed": "Password admin cambiata",
  "admin.recovery_regenerated": "Nuovi codici di recupero admin",
  "admin.sessions_revoked": "Sessioni admin chiuse",
  "user.suspended": "Utente sospeso",
  "user.reactivated": "Utente riattivato",
  "user.sessions_revoked": "Sessioni dell'utente chiuse",
  "user.two_factor_reset": "Verifica in due passaggi azzerata",
  "user.email_verified": "Email confermata a mano",
  "user.password_reset_sent": "Link di reset password inviato",
  "user.pro_granted": "Pro in omaggio",
  "user.pro_revoked": "Pro in omaggio tolto",
  "user.subscription_canceled": "Abbonamento disdetto",
  "user.subscription_resumed": "Abbonamento riattivato",
  "user.deleted": "Utente eliminato",
  "user.note_added": "Nota aggiunta",
  "user.note_deleted": "Nota eliminata",
  "users.exported": "Utenti esportati in CSV",
} as const;

export type AuditAction = keyof typeof ACTIONS;

export async function audit(
  adminId: string | null,
  action: AuditAction,
  {
    target,
    details,
  }: { target?: { id: string; email: string }; details?: Prisma.InputJsonValue } = {},
) {
  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action,
      targetUserId: target?.id ?? null,
      targetEmail: target?.email ?? null,
      details,
      ip: await clientIp(),
    },
  });
}

export const actionLabel = (action: string) =>
  ACTIONS[action as AuditAction] ?? action.replace(/[._]/g, " ");
