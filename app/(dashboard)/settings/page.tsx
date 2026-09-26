import { requireSpace } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { DigestToggle, ProfileForm } from "./settings-forms";
import { SpaceSettings } from "./space-settings";

export const metadata = { title: "Impostazioni · FinTrack" };

export default async function SettingsPage() {
  const space = await requireSpace();
  const [user, members, invites] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: space.user.id },
      select: { name: true, email: true, weeklyDigest: true },
    }),
    prisma.householdMember.findMany({
      where: { householdId: space.id },
      orderBy: { joinedAt: "asc" },
      select: { role: true, user: { select: { id: true, name: true, email: true } } },
    }),
    space.role === "OWNER"
      ? prisma.householdInvite.findMany({
          where: { householdId: space.id, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, expiresAt: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="grid max-w-2xl grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="text-muted-foreground text-sm">
          Il tuo profilo, lo spazio condiviso e le notifiche.
        </p>
      </div>
      <section
        className="bg-card grid gap-4 rounded-2xl border p-5"
        aria-labelledby="profile-title"
      >
        <h2 id="profile-title" className="font-medium">
          Profilo
        </h2>
        <ProfileForm name={user.name ?? ""} email={user.email} />
      </section>
      <section className="bg-card grid gap-4 rounded-2xl border p-5" aria-labelledby="space-title">
        <div>
          <h2 id="space-title" className="font-medium">
            Spazio «{space.name}»
          </h2>
          <p className="text-muted-foreground text-sm">
            Invita partner o famiglia: vedrete gli stessi conti, movimenti, budget e obiettivi.
          </p>
        </div>
        <SpaceSettings
          data={{
            name: space.name,
            currency: space.currency,
            isOwner: space.role === "OWNER",
            currentUserId: space.user.id,
            members: members.map((m) => ({
              userId: m.user.id,
              name: m.user.name ?? m.user.email.split("@")[0],
              email: m.user.email,
              role: m.role,
            })),
            invites: invites.map((i) => ({
              id: i.id,
              email: i.email,
              expiresAt: i.expiresAt.toISOString(),
            })),
          }}
        />
      </section>
      <section className="bg-card grid gap-4 rounded-2xl border p-5" aria-label="Notifiche">
        <DigestToggle enabled={user.weeklyDigest} />
      </section>
    </div>
  );
}
