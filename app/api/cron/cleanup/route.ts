import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;

// Called by Vercel Cron every night (see vercel.json), with "Authorization: Bearer $CRON_SECRET".
// Rate-limit counters hold emails and IPs: the privacy policy promises they go within 2 days.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const now = new Date();
  const [rateLimits, resetTokens, emailTokens, invites, loginTickets, gifts, auditLogs] =
    await prisma.$transaction([
      prisma.rateLimit.deleteMany({
        where: { windowStart: { lt: new Date(now.getTime() - DAY_MS) } },
      }),
      prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.householdInvite.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.loginTicket.deleteMany({ where: { expiresAt: { lt: now } } }),
      // Pro given from the admin panel ("comp") ends on its date; Stripe never touches these.
      prisma.user.updateMany({
        where: { subscriptionStatus: "comp", planRenewsAt: { lt: now } },
        data: {
          plan: "FREE",
          subscriptionStatus: null,
          planRenewsAt: null,
          planCancelsAtEnd: false,
        },
      }),
      prisma.adminAuditLog.deleteMany({
        where: { createdAt: { lt: new Date(now.getTime() - YEAR_MS) } },
      }),
    ]);

  return Response.json({
    rateLimits: rateLimits.count,
    resetTokens: resetTokens.count,
    emailTokens: emailTokens.count,
    invites: invites.count,
    loginTickets: loginTickets.count,
    giftsEnded: gifts.count,
    auditLogs: auditLogs.count,
  });
}
