import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { DigestToggle, ProfileForm } from "./settings-forms";

export const metadata = { title: "Impostazioni · FinTrack" };

export default async function SettingsPage() {
  const session = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { name: true, email: true, weeklyDigest: true },
  });

  return (
    <div className="grid max-w-2xl grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="text-muted-foreground text-sm">Il tuo profilo e le notifiche.</p>
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
      <section className="bg-card grid gap-4 rounded-2xl border p-5" aria-label="Notifiche">
        <DigestToggle enabled={user.weeklyDigest} />
      </section>
    </div>
  );
}
