import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { RegisterWizard } from "@/components/register/register-wizard";
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
      <CardContent>
        <h1 className="sr-only">Crea il tuo account FinTrack</h1>
        <RegisterWizard callbackUrl={callbackUrl} email={email} />
      </CardContent>
    </Card>
  );
}
