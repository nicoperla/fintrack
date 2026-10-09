import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";
import { overview, signupsByDay } from "@/lib/stats";
import { recurringRevenue } from "@/lib/stripe";
import { stripeConfigured } from "@/lib/config";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { subscriptionLabel } from "@/lib/users";
import { BarChart } from "@/components/bar-chart";
import { Badge, Card, Empty, PageTitle, Stat } from "@/components/ui";

export const metadata = { title: "Panoramica" };

async function revenue() {
  if (!stripeConfigured()) return null;
  try {
    return await recurringRevenue();
  } catch (error) {
    console.error("[admin] Stripe non raggiungibile", error);
    return "error" as const;
  }
}

export default async function OverviewPage() {
  const [stats, signups, recent, money] = await Promise.all([
    overview(),
    signupsByDay(30),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        plan: true,
        subscriptionStatus: true,
        planCancelsAtEnd: true,
      },
    }),
    revenue(),
  ]);

  const alerts = [
    stats.pastDue > 0 && {
      text: `${stats.pastDue} ${stats.pastDue === 1 ? "pagamento fallito" : "pagamenti falliti"}: Stripe sta riprovando.`,
      href: "/abbonamenti?status=past_due",
    },
    stats.suspended > 0 && {
      text: `${stats.suspended} ${stats.suspended === 1 ? "account sospeso" : "account sospesi"}.`,
      href: "/utenti?suspended=yes",
    },
  ].filter(Boolean) as { text: string; href: string }[];

  return (
    <>
      <PageTitle title="Panoramica" text="Come sta andando FinTrack, oggi." />

      {alerts.length > 0 && (
        <div className="mb-6 grid gap-2">
          {alerts.map((alert) => (
            <Link
              key={alert.href}
              href={alert.href}
              className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200 hover:bg-amber-400/15"
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {alert.text}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Utenti"
          value={formatNumber(stats.users)}
          hint={`+${stats.signups.today} oggi · +${stats.signups.week} in 7 giorni`}
        />
        <Stat
          label="Abbonati Pro"
          value={formatNumber(stats.pro)}
          tone="accent"
          hint={`${formatPercent(stats.pro, stats.users)} degli utenti${stats.gifts ? ` · ${stats.gifts} in omaggio` : ""}`}
        />
        <Stat
          label="Ricavi mensili (MRR)"
          value={
            money === null
              ? "—"
              : money === "error"
                ? "Errore"
                : formatMoney(money.mrr, money.currency)
          }
          hint={
            money === null
              ? "Stripe non collegato"
              : money === "error"
                ? "Stripe non risponde"
                : `ARR ${formatMoney(money.mrr * 12, money.currency)}`
          }
        />
        <Stat
          label="Accessi in 7 giorni"
          value={formatNumber(stats.active7)}
          hint={`${formatNumber(stats.active30)} in 30 giorni`}
        />
        <Stat
          label="Email confermate"
          value={formatPercent(stats.verified, stats.users)}
          hint={`${formatNumber(stats.verified)} account`}
        />
        <Stat
          label="Con 2FA"
          value={formatPercent(stats.twoFactor, stats.users)}
          hint={`${formatNumber(stats.twoFactor)} account`}
        />
        <Stat
          label="Disdette in corso"
          value={formatNumber(stats.cancelling)}
          tone={stats.cancelling ? "warn" : undefined}
          hint="Pro fino a fine periodo"
        />
        <Stat
          label="Movimenti registrati"
          value={formatNumber(stats.transactions)}
          hint={`${formatNumber(stats.households)} spazi · ${formatNumber(stats.claims)} pratiche`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Iscrizioni negli ultimi 30 giorni">
          <BarChart points={signups} label="Iscrizioni al giorno negli ultimi 30 giorni" />
        </Card>
        <Card
          title="Ultimi iscritti"
          action={
            <Link href="/utenti" className="text-accent text-sm hover:underline">
              Tutti
            </Link>
          }
        >
          {recent.length === 0 ? (
            <Empty>Ancora nessun utente.</Empty>
          ) : (
            <ul className="divide-line/60 grid divide-y">
              {recent.map((user) => {
                const sub = subscriptionLabel(user);
                return (
                  <li key={user.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/utenti/${user.id}`} className="min-w-0 hover:underline">
                      <span className="block truncate text-sm text-white">
                        {user.name || user.email}
                      </span>
                      <span className="text-muted block truncate text-xs">
                        {user.email} · {formatDate(user.createdAt)}
                      </span>
                    </Link>
                    <Badge tone={sub.tone}>{sub.text}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
