import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdmin } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Accesso" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/");
  const configured = (await prisma.adminUser.count({ where: { activatedAt: { not: null } } })) > 0;

  return (
    <AuthShell
      title="Accesso amministratore"
      text="Email, password e il codice dell'app di autenticazione."
    >
      {configured ? (
        <LoginForm />
      ) : (
        <p className="text-muted text-sm">
          Il pannello non ha ancora un amministratore.{" "}
          <Link href="/setup" className="text-accent underline underline-offset-4">
            Configuralo adesso
          </Link>
          .
        </p>
      )}
    </AuthShell>
  );
}
