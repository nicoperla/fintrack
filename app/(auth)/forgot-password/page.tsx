import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export const metadata = { title: "Password dimenticata · FinTrack" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Password dimenticata?</CardTitle>
        <CardDescription>
          Inserisci la tua email e ti mandiamo un link per reimpostarla.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ForgotPasswordForm />
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground text-center text-sm underline-offset-4 hover:underline"
        >
          Torna al login
        </Link>
      </CardContent>
    </Card>
  );
}
