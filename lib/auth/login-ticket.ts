import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import {
  deviceCookieName,
  deviceCookieOptions,
  describeDevice,
  hashDeviceId,
  isDeviceId,
  newDeviceId,
  placeFromHeaders,
} from "@/lib/auth/devices";
import { checkSecondFactor } from "@/lib/auth/two-factor";
import {
  notifyNewDevice,
  notifyRecoveryCodeUsed,
  notifyWrongCode,
} from "@/lib/auth/security-emails";
import { rateLimit, RULES } from "@/lib/rate-limit";

/*
 * Signing in takes two requests. The password (server action) gives a ticket; the ticket, plus
 * the 2FA code when it's on, gives the session (NextAuth). The ticket lives 10 minutes, works
 * once, only in the browser that asked for it, and allows a handful of wrong codes.
 */

export const TICKET_TTL_MS = 10 * 60 * 1000;
export const TICKET_MAX_ATTEMPTS = 5;
/** Wrong codes on one ticket before the "someone knows your password" email. */
const ALERT_AFTER = 3;
/** Browsers remembered per account (for the new-device email and the list in settings). */
export const MAX_DEVICES = 20;

export type Device = { deviceHash: string; label: string; place: string | null };

const hashTicket = (token: string) => createHash("sha256").update(`ticket:${token}`).digest("hex");

export const isTicket = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

/**
 * The browser making this request (server actions). Signing in (`refresh`) sets the device
 * cookie again, so a browser in use is never forgotten. Elsewhere it's only set when missing
 * (the middleware sets it on every page): setting a cookie makes Next.js render the page again
 * in the same response, and right after the session version went up that render would find the
 * old session and send the user to the login page.
 */
export function currentDevice({ refresh = false }: { refresh?: boolean } = {}): Device {
  const store = cookies();
  const existing = store.get(deviceCookieName())?.value;
  const id = isDeviceId(existing) ? existing : newDeviceId();
  if (refresh || id !== existing) store.set(deviceCookieName(), id, deviceCookieOptions());
  const h = headers();
  return {
    deviceHash: hashDeviceId(id),
    label: describeDevice(h.get("user-agent")),
    place: placeFromHeaders(h),
  };
}

export async function issueTicket(
  userId: string,
  device: Device,
  { secondFactorDone = false }: { secondFactorDone?: boolean } = {},
) {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // One pending sign-in per browser; expired tickets go too.
    prisma.loginTicket.deleteMany({
      where: {
        OR: [{ userId, deviceHash: device.deviceHash }, { expiresAt: { lt: new Date() } }],
      },
    }),
    prisma.loginTicket.create({
      data: {
        userId,
        tokenHash: hashTicket(token),
        deviceHash: device.deviceHash,
        deviceLabel: device.label,
        place: device.place,
        secondFactorDone,
        expiresAt: new Date(Date.now() + TICKET_TTL_MS),
      },
    }),
  ]);
  return token;
}

export type TicketError = "EXPIRED" | "CODE_REQUIRED" | "BAD_CODE" | "RATE_LIMITED";

export type RedeemResult =
  | {
      ok: true;
      user: { id: string; email: string; name: string | null; sessionVersion: number };
    }
  | { ok: false; error: TicketError };

/** Trades a ticket (and the code, when 2FA is on) for the user to start a session with. */
export async function redeemTicket({
  token,
  code,
  deviceId,
}: {
  token: string;
  code?: string;
  deviceId: string | null;
}): Promise<RedeemResult> {
  const ticket = await prisma.loginTicket.findUnique({
    where: { tokenHash: hashTicket(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          sessionVersion: true,
          twoFactorEnabledAt: true,
          totpSecret: true,
          totpLastStep: true,
        },
      },
    },
  });
  if (
    !ticket ||
    ticket.expiresAt < new Date() ||
    !deviceId ||
    hashDeviceId(deviceId) !== ticket.deviceHash
  ) {
    return { ok: false, error: "EXPIRED" };
  }
  const { user } = ticket;
  const where = { device: ticket.deviceLabel, place: ticket.place };

  let recoveryLeft: number | null = null;
  if (user.twoFactorEnabledAt && !ticket.secondFactorDone) {
    if (!code) return { ok: false, error: "CODE_REQUIRED" };
    const check = await checkSecondFactor(user, code);
    if (!check.ok) {
      if (check.error === "BAD_CODE") await wrongCode(ticket.id, user, where);
      return { ok: false, error: check.error };
    }
    if (check.method === "recovery") recoveryLeft = check.remaining;
  }

  // Single use: of two requests with the same ticket, only one deletes it.
  const { count } = await prisma.loginTicket.deleteMany({ where: { id: ticket.id } });
  if (count === 0) return { ok: false, error: "EXPIRED" };

  await rememberDevice(user, ticket.deviceHash, where);
  if (recoveryLeft !== null) await notifyRecoveryCodeUsed(user, recoveryLeft, where);

  return {
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion },
  };
}

async function wrongCode(
  ticketId: string,
  user: { id: string; email: string; name: string | null },
  where: { device: string; place: string | null },
) {
  const ticket = await prisma.loginTicket
    .update({ where: { id: ticketId }, data: { attempts: { increment: 1 } } })
    .catch(() => null);
  if (!ticket) return;
  if (ticket.attempts >= TICKET_MAX_ATTEMPTS) {
    await prisma.loginTicket.deleteMany({ where: { id: ticketId } });
  }
  if (ticket.attempts === ALERT_AFTER) {
    const alert = await rateLimit(`security-alert:${user.id}`, RULES.securityAlert);
    if (alert.ok) await notifyWrongCode(user, where);
  }
}

/** Notes the browser; one the account never used before gets an email (not the very first). */
async function rememberDevice(
  user: { id: string; email: string; name: string | null },
  deviceHash: string,
  where: { device: string; place: string | null },
) {
  const key = { userId_deviceHash: { userId: user.id, deviceHash } };
  const known = await prisma.knownDevice.findUnique({ where: key, select: { userId: true } });
  if (known) {
    await prisma.knownDevice.update({
      where: key,
      data: { label: where.device, place: where.place, lastLoginAt: new Date() },
    });
    return;
  }

  const others = await prisma.knownDevice.findMany({
    where: { userId: user.id },
    orderBy: { lastLoginAt: "desc" },
    select: { deviceHash: true },
  });
  await prisma.knownDevice.upsert({
    where: key,
    create: { userId: user.id, deviceHash, label: where.device, place: where.place },
    update: { lastLoginAt: new Date() },
  });
  const forgotten = others.slice(MAX_DEVICES - 1).map((d) => d.deviceHash);
  if (forgotten.length > 0) {
    await prisma.knownDevice.deleteMany({
      where: { userId: user.id, deviceHash: { in: forgotten } },
    });
  }
  if (others.length > 0) await notifyNewDevice(user, where);
}
