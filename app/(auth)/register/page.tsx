import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/components/forms/register-form";
import { getSession } from "@/lib/auth/session";
import { safeCallbackUrl } from "@/lib/auth/callback-url";

export const metadata = { title: "Registrati · FinTrack" };

type SearchParams = { callbackUrl?: string | string[]; email?: string | string[] };

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const callbackUrl = safeCallbackUrl(searchParams.callbackUrl);
  if (await getSession()) redirect(callbackUrl);
  const email = typeof searchParams.email === "string" ? searchParams.email : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Crea il tuo account</CardTitle>
        <CardDescription>Bastano pochi secondi per iniziare.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <RegisterForm callbackUrl={callbackUrl} email={email} />
        <p className="text-muted-foreground text-center text-sm">
          Hai già un account?{" "}
          <Link
            href={`/login?${new URLSearchParams({ callbackUrl })}`}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Accedi
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
