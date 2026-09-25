import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email";
import { getDigestInput } from "@/lib/data/digest";
import { buildWeeklyDigest } from "@/lib/reports/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Resend's free tier accepts 2 requests per second.
const pause = () => new Promise((resolve) => setTimeout(resolve, 600));

// Called by Vercel Cron every Monday morning (see vercel.json). Vercel sends
// "Authorization: Bearer $CRON_SECRET"; without the secret configured nothing is sent.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { weeklyDigest: true, accounts: { some: {} } },
    select: { id: true, email: true },
  });

  let sent = 0;
  const failed: string[] = [];
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (i > 0) await pause();
    try {
      const input = await getDigestInput(user.id);
      const email = buildWeeklyDigest(input);
      await sendEmail({
        to: user.email,
        ...email,
        headers: {
          "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      sent++;
    } catch (error) {
      console.error(`[digest] invio fallito per ${user.id}`, error);
      failed.push(user.id);
    }
  }

  return Response.json({ users: users.length, sent, failed: failed.length });
}
