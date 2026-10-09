import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getAdmin } from "@/lib/auth/session";
import { readFilters, subscriptionLabel, toCsv, usersWhere } from "@/lib/users";

export const dynamic = "force-dynamic";

/** The users list as CSV (semicolons, for Excel in Italian), with the filters in the URL. */
export async function GET(request: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Non autorizzato", { status: 401 });

  const filters = readFilters(Object.fromEntries(new URL(request.url).searchParams));
  const users = await prisma.user.findMany({
    where: usersWhere(filters),
    orderBy: { createdAt: "asc" },
    take: 50_000,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      plan: true,
      subscriptionStatus: true,
      planRenewsAt: true,
      planCancelsAtEnd: true,
      emailVerifiedAt: true,
      twoFactorEnabledAt: true,
      suspendedAt: true,
    },
  });
  const iso = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");
  const csv = toCsv([
    [
      "ID",
      "Email",
      "Nome",
      "Iscritto",
      "Piano",
      "Abbonamento",
      "Rinnovo",
      "Email confermata",
      "2FA",
      "Sospeso",
    ],
    ...users.map((u) => [
      u.id,
      u.email,
      u.name,
      iso(u.createdAt),
      u.plan,
      subscriptionLabel(u).text,
      iso(u.planRenewsAt),
      u.emailVerifiedAt ? "sì" : "no",
      u.twoFactorEnabledAt ? "sì" : "no",
      u.suspendedAt ? "sì" : "no",
    ]),
  ]);
  await audit(admin.id, "users.exported", { details: { rows: users.length, filters } });

  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fintrack-utenti-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
