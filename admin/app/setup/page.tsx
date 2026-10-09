import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthShell } from "@/components/auth-shell";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Once there's an admin, this page doesn't exist any more.
  if ((await prisma.adminUser.count({ where: { activatedAt: { not: null } } })) > 0) notFound();

  return (
    <AuthShell
      title="Configura il pannello"
      text="Crea l'account amministratore. Servono il codice di setup (ADMIN_SETUP_TOKEN) e un'app di autenticazione sul telefono."
    >
      <SetupForm />
    </AuthShell>
  );
}
