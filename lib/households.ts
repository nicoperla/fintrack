import { cache } from "react";
import { createHash } from "crypto";
import type { HouseholdRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Person = { id: string; name?: string | null; email?: string | null };

export function personalSpaceName({ name, email }: Omit<Person, "id">) {
  const first = name?.trim().split(/\s+/)[0] || email?.split("@")[0] || "te";
  return `Spazio di ${first}`;
}

/**
 * Every user owns a personal space, with the user's own id (so a user's first space is easy to
 * find, and the migration from per-user data could map rows one to one). Idempotent.
 */
export async function ensurePersonalHousehold(user: Person) {
  await prisma.$transaction([
    prisma.household.upsert({
      where: { id: user.id },
      create: { id: user.id, name: personalSpaceName(user), ownerId: user.id },
      update: {},
    }),
    prisma.householdMember.upsert({
      where: { householdId_userId: { householdId: user.id, userId: user.id } },
      create: { householdId: user.id, userId: user.id, role: "OWNER" },
      update: {},
    }),
  ]);
}

export type ActiveSpace = {
  /** The household id: every financial record is scoped by it. */
  id: string;
  name: string;
  /** Base currency of the space. */
  currency: string;
  role: HouseholdRole;
  /** All the spaces the user belongs to, for the switcher. */
  spaces: { id: string; name: string; role: HouseholdRole; memberCount: number }[];
};

/**
 * The space the user is working in: the one they picked if they're still a member, otherwise
 * their own. Also used outside requests (weekly digest), so it takes a plain user.
 */
export async function getActiveSpace(user: Person): Promise<ActiveSpace> {
  const load = () =>
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        activeHouseholdId: true,
        memberships: {
          orderBy: { joinedAt: "asc" },
          select: {
            role: true,
            household: {
              select: {
                id: true,
                name: true,
                currency: true,
                ownerId: true,
                _count: { select: { members: true } },
              },
            },
          },
        },
      },
    });

  let row = await load();
  if (row.memberships.length === 0) {
    // Accounts created before spaces existed, or whose space was lost: give them one back.
    await ensurePersonalHousehold(user);
    row = await load();
  }

  const memberships = row.memberships;
  const active =
    memberships.find((m) => m.household.id === row.activeHouseholdId) ??
    memberships.find((m) => m.household.ownerId === user.id) ??
    memberships[0];

  return {
    id: active.household.id,
    name: active.household.name,
    currency: active.household.currency,
    role: active.role,
    spaces: memberships.map((m) => ({
      id: m.household.id,
      name: m.household.name,
      role: m.role,
      memberCount: m.household._count.members,
    })),
  };
}

/** Base currency of a space (deduplicated per request). */
export const getHouseholdCurrency = cache(async (householdId: string) => {
  const household = await prisma.household.findUniqueOrThrow({
    where: { id: householdId },
    select: { currency: true },
  });
  return household.currency;
});

/** Invitation links carry a random token; only its SHA-256 is stored. */
export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** The pending invitation behind a link, or null when unknown or expired. */
export async function findInvite(token: string) {
  const invite = await prisma.householdInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: {
      household: { select: { id: true, name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });
  return invite && invite.expiresAt > new Date() ? invite : null;
}
