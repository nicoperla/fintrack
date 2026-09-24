import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { FormMessage } from "@/components/forms/form-field";

export const metadata = { title: "Reimposta password · FinTrack" };

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reimposta la password</CardTitle>
        <CardDescription>Scegli una nuova password per il tuo account.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <FormMessage tone="error">
            Link non valido. Richiedi un nuovo link dalla pagina{" "}
            <Link href="/forgot-password" className="font-medium underline">
              password dimenticata
            </Link>
            .
          </FormMessage>
        )}
      </CardContent>
    </Card>
  );
}
