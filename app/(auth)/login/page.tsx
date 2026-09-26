import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/forms/login-form";
import { getSession } from "@/lib/auth/session";
import { safeCallbackUrl } from "@/lib/auth/callback-url";

export const metadata = { title: "Accedi · FinTrack" };

type SearchParams = { callbackUrl?: string | string[]; reset?: string };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const callbackUrl = safeCallbackUrl(searchParams.callbackUrl);
  if (await getSession()) redirect(callbackUrl);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Bentornato</CardTitle>
        <CardDescription>Accedi per vedere le tue finanze.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <LoginForm
          callbackUrl={callbackUrl}
          notice={searchParams.reset ? "Password aggiornata. Ora puoi accedere." : undefined}
        />
        <div className="text-muted-foreground flex flex-col gap-1 text-center text-sm">
          <Link
            href="/forgot-password"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Password dimenticata?
          </Link>
          <p>
            Non hai un account?{" "}
            <Link
              href={`/register?${new URLSearchParams({ callbackUrl })}`}
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              Registrati
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
