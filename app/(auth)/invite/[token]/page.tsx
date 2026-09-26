import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { findInvite } from "@/lib/households";
import { acceptInvite } from "./actions";

export const metadata = { title: "Invito · FinTrack" };

export default async function InvitePage({ params }: { params: { token: string } }) {
  const [invite, session] = await Promise.all([findInvite(params.token), getSession()]);

  if (!invite) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Invito non valido</CardTitle>
          <CardDescription>
            Il link è scaduto, è già stato usato oppure è stato annullato. Chiedi a chi ti ha
            invitato di mandartene uno nuovo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Vai a FinTrack
          </Link>
        </CardContent>
      </Card>
    );
  }

  const inviter = invite.invitedBy?.name ?? invite.invitedBy?.email ?? "Qualcuno";
  const back = `/invite/${params.token}`;
  const header = (
    <CardHeader>
      <span className="bg-muted mb-2 flex size-10 items-center justify-center rounded-full">
        <Users className="size-5" aria-hidden />
      </span>
      <CardTitle className="text-xl">Unisciti a «{invite.household.name}»</CardTitle>
      <CardDescription>
        {inviter} ti ha invitato a gestire insieme conti, movimenti, budget e obiettivi.
      </CardDescription>
    </CardHeader>
  );

  if (!session) {
    return (
      <Card>
        {header}
        <CardContent className="grid gap-3">
          <p className="text-muted-foreground text-sm">
            L&apos;invito è per <span className="text-foreground font-medium">{invite.email}</span>:
            accedi o crea un account con questa email.
          </p>
          <Link
            href={`/register?${new URLSearchParams({ callbackUrl: back, email: invite.email })}`}
            className={buttonVariants()}
          >
            Crea un account
          </Link>
          <Link
            href={`/login?${new URLSearchParams({ callbackUrl: back })}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Ho già un account
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (session.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Card>
        {header}
        <CardContent className="grid gap-3">
          <p className="text-muted-foreground text-sm">
            L&apos;invito è per <span className="text-foreground font-medium">{invite.email}</span>,
            ma sei connesso come{" "}
            <span className="text-foreground font-medium">{session.user.email}</span>. Esci e accedi
            con l&apos;account giusto.
          </p>
          <Link href="/api/auth/signout" className={buttonVariants({ variant: "outline" })}>
            Esci
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent className="grid gap-3">
        <p className="text-muted-foreground text-sm">
          Vedrete gli stessi dati e ognuno potrà registrare movimenti. Il tuo spazio personale resta
          separato: puoi passare dall&apos;uno all&apos;altro quando vuoi.
        </p>
        <form action={acceptInvite.bind(null, params.token)}>
          <Button type="submit" className="w-full">
            Accetta l&apos;invito
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
