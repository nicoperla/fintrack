import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/components/forms/register-form";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Registrati · FinTrack" };

export default async function RegisterPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Crea il tuo account</CardTitle>
        <CardDescription>Bastano pochi secondi per iniziare.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <RegisterForm />
        <p className="text-muted-foreground text-center text-sm">
          Hai già un account?{" "}
          <Link
            href="/login"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Accedi
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
