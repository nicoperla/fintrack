import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { securityEmail, type SecurityNotice, type SignInPlace } from "@/lib/emails/templates";

/*
 * Security notices: a new browser signed in, the password or 2FA changed, a wrong code after
 * the right password. They never block the action they describe: a failed send is only logged.
 * The wording and the look are in lib/emails/templates.ts.
 */

type Recipient = { email: string; name?: string | null };

export type { SignInPlace };

async function notify(user: Recipient, notice: SecurityNotice) {
  const email = securityEmail(notice, { appUrl: getAppUrl(), name: user.name });
  try {
    await sendEmail({ to: user.email, ...email });
  } catch (error) {
    console.error(`[security] invio email «${email.subject}» fallito`, error);
  }
}

export const notifyNewDevice = (user: Recipient, where: SignInPlace) =>
  notify(user, { kind: "new-device", where });

export const notifyWrongCode = (user: Recipient, where: SignInPlace) =>
  notify(user, { kind: "wrong-code", where });

export const notifyPasswordChanged = (user: Recipient) =>
  notify(user, { kind: "password-changed" });

export const notifyTwoFactor = (user: Recipient, enabled: boolean) =>
  notify(user, { kind: enabled ? "two-factor-on" : "two-factor-off" });

export const notifyRecoveryCodeUsed = (user: Recipient, remaining: number, where: SignInPlace) =>
  notify(user, { kind: "recovery-code", where, remaining });
