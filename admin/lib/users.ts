import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/*
 * The users list: search, filters and sorting come from the URL, so a filtered view can be
 * bookmarked and exported as it is.
 */

export const PAGE_SIZE = 50;

export type UserFilters = {
  q: string;
  plan: "" | "FREE" | "PRO";
  status: "" | "active" | "trialing" | "past_due" | "canceled" | "comp" | "none";
  verified: "" | "yes" | "no";
  twofa: "" | "yes" | "no";
  suspended: "" | "yes" | "no";
  sort: "new" | "old" | "email" | "name";
  page: number;
};

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

export function readFilters(params: Record<string, string | string[] | undefined>): UserFilters {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const page = Number.parseInt(one("page") ?? "1", 10);
  return {
    q: (one("q") ?? "").trim().slice(0, 100),
    plan: pick(one("plan"), ["", "FREE", "PRO"] as const, ""),
    status: pick(
      one("status"),
      ["", "active", "trialing", "past_due", "canceled", "comp", "none"] as const,
      "",
    ),
    verified: pick(one("verified"), ["", "yes", "no"] as const, ""),
    twofa: pick(one("twofa"), ["", "yes", "no"] as const, ""),
    suspended: pick(one("suspended"), ["", "yes", "no"] as const, ""),
    sort: pick(one("sort"), ["new", "old", "email", "name"] as const, "new"),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

export function usersWhere(f: UserFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  if (f.q) {
    and.push({
      OR: [
        { email: { contains: f.q, mode: "insensitive" } },
        { name: { contains: f.q, mode: "insensitive" } },
        { id: f.q },
        { stripeCustomerId: f.q },
      ],
    });
  }
  if (f.plan) and.push({ plan: f.plan });
  if (f.status === "none") and.push({ subscriptionStatus: null });
  else if (f.status) and.push({ subscriptionStatus: f.status });
  if (f.verified) and.push({ emailVerifiedAt: f.verified === "yes" ? { not: null } : null });
  if (f.twofa) and.push({ twoFactorEnabledAt: f.twofa === "yes" ? { not: null } : null });
  if (f.suspended) and.push({ suspendedAt: f.suspended === "yes" ? { not: null } : null });
  return and.length ? { AND: and } : {};
}

const ORDER: Record<UserFilters["sort"], Prisma.UserOrderByWithRelationInput> = {
  new: { createdAt: "desc" },
  old: { createdAt: "asc" },
  email: { email: "asc" },
  name: { name: "asc" },
};

export const userRowSelect = {
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
  knownDevices: { orderBy: { lastLoginAt: "desc" }, take: 1, select: { lastLoginAt: true } },
  _count: { select: { transactions: true, memberships: true } },
} satisfies Prisma.UserSelect;

export type UserRow = Prisma.UserGetPayload<{ select: typeof userRowSelect }>;

export async function listUsers(f: UserFilters) {
  const where = usersWhere(f);
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [ORDER[f.sort], { id: "asc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: userRowSelect,
    }),
    prisma.user.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** The URL of the list with some filters changed (page back to 1 unless given). */
export function filtersHref(f: UserFilters, changes: Partial<UserFilters>, base = "/utenti") {
  const merged = { ...f, page: 1, ...changes };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === "" || (key === "sort" && value === "new") || (key === "page" && value === 1)) {
      continue;
    }
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** The subscription as one word, with the colour to show it in. */
export function subscriptionLabel(user: {
  plan: string;
  subscriptionStatus: string | null;
  planCancelsAtEnd: boolean;
}): { text: string; tone: "green" | "amber" | "red" | "violet" | "neutral" } {
  switch (user.subscriptionStatus) {
    case "comp":
      return { text: "Pro omaggio", tone: "violet" };
    case "active":
      return user.planCancelsAtEnd
        ? { text: "Pro, disdetto", tone: "amber" }
        : { text: "Pro", tone: "green" };
    case "trialing":
      return { text: "Pro in prova", tone: "green" };
    case "past_due":
      return { text: "Pagamento fallito", tone: "red" };
    case "canceled":
      return { text: "Ex Pro", tone: "neutral" };
    case null:
      return user.plan === "PRO"
        ? { text: "Pro", tone: "green" }
        : { text: "Free", tone: "neutral" };
    default:
      return { text: user.subscriptionStatus, tone: "amber" };
  }
}

/** CSV with every cell quoted; cells starting like a formula are neutralised for Excel. */
export function toCsv(rows: (string | number | null)[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let text = cell === null ? "" : String(cell);
          if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(";"),
    )
    .join("\r\n");
}
