import Link from "next/link";
import { CircleCheck, CircleX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { verifyEmailToken } from "@/lib/auth/email-verification";

export const metadata = { title: "Conferma email · FinTrack" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string | string[] };
}) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  const result = token ? await verifyEmailToken(token) : "invalid";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          {result === "verified" ? (
            <CircleCheck className="size-5 text-(--delta-good)" aria-hidden />
          ) : (
            <CircleX className="text-destructive size-5" aria-hidden />
          )}
          {result === "verified" ? "Email confermata" : "Link non valido"}
        </CardTitle>
        <CardDescription>
          {result === "verified"
            ? "Grazie! Ora puoi invitare altre persone nei tuoi spazi e usare il coach AI."
            : "Il link è scaduto o è già stato usato. Accedi e chiedi un nuovo link dal banner in alto."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>
          Vai a FinTrack
        </Link>
      </CardContent>
    </Card>
  );
}
