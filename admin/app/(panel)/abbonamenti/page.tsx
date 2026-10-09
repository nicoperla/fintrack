import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { stripeConfigured } from "@/lib/config";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { recurringRevenue } from "@/lib/stripe";
import { subscriptionLabel } from "@/lib/users";
import { Badge, Card, Empty, PageTitle, Stat, Table, td, th, cn } from "@/components/ui";

export const metadata = { title: "Abbonamenti" };

const FILTERS = [
  { key: "", label: "Tutti" },
  { key: "active", label: "Attivi" },
  { key: "cancelling", label: "In disdetta" },
  { key: "past_due", label: "Pagamento fallito" },
  { key: "trialing", label: "In prova" },
  { key: "comp", label: "Omaggio" },
  { key: "canceled", label: "Finiti" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

function whereFor(filter: Filter): Prisma.UserWhereInput {
  switch (filter) {
    case "cancelling":
      return { plan: "PRO", planCancelsAtEnd: true, subscriptionStatus: { not: "comp" } };
    case "":
      return { subscriptionStatus: { not: null } };
    default:
      return { subscriptionStatus: filter };
  }
}

async function revenue() {
  if (!stripeConfigured()) return null;
  try {
    return await recurringRevenue();
  } catch {
    return "error" as const;
  }
}

export default async function SubscriptionsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const searchParams = await props.searchParams;
  const filter = (FILTERS.find((f) => f.key === searchParams.status)?.key ?? "") as Filter;
  const in7days = new Date(Date.now() + 7 * 86_400_000);
  const [rows, counts, renewing, money] = await Promise.all([
    prisma.user.findMany({
      where: whereFor(filter),
      orderBy: { planRenewsAt: "asc" },
      take: 200,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
        planRenewsAt: true,
        planCancelsAtEnd: true,
        stripeCustomerId: true,
      },
    }),
    prisma.user.groupBy({ by: ["subscriptionStatus"], _count: { _all: true } }),
    prisma.user.count({
      where: {
        subscriptionStatus: "active",
        planCancelsAtEnd: false,
        planRenewsAt: { gte: new Date(), lte: in7days },
      },
    }),
    revenue(),
  ]);
  const count = (status: string) =>
    counts.find((c) => c.subscriptionStatus === status)?._count._all ?? 0;

  return (
    <>
      <PageTitle
        title="Abbonamenti"
        text="Chi paga Pro, chi lo sta lasciando, chi ce l'ha in omaggio."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="MRR"
          tone="accent"
          value={
            money === null
              ? "—"
              : money === "error"
                ? "Errore"
                : formatMoney(money.mrr, money.currency)
          }
          hint={money === null ? "Collega Stripe" : "ricavi ricorrenti al mese"}
        />
        <Stat
          label="Attivi"
          value={formatNumber(count("active"))}
          hint={`${renewing} si rinnovano entro 7 giorni`}
        />
        <Stat
          label="Pagamenti falliti"
          value={formatNumber(count("past_due"))}
          tone={count("past_due") ? "warn" : undefined}
          hint="Stripe riprova da solo"
        />
        <Stat label="In omaggio" value={formatNumber(count("comp"))} hint="dal pannello" />
      </div>

      <nav aria-label="Filtri" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/abbonamenti?status=${f.key}` : "/abbonamenti"}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm",
              f.key === filter
                ? "bg-accent text-accent-ink font-medium"
                : "bg-raised text-muted hover:text-white",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <Card>
        {rows.length === 0 ? (
          <Empty>Nessun abbonamento in questo gruppo.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Utente</th>
                <th className={th}>Stato</th>
                <th className={th}>Rinnovo o scadenza</th>
                <th className={th}>Stripe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => {
                const sub = subscriptionLabel(user);
                return (
                  <tr key={user.id} className="hover:bg-raised/50">
                    <td className={td}>
                      <Link
                        href={`/utenti/${user.id}`}
                        className="block max-w-[18rem] hover:underline"
                      >
                        <span className="block truncate text-white">{user.name || user.email}</span>
                        <span className="text-muted block truncate text-xs">{user.email}</span>
                      </Link>
                    </td>
                    <td className={td}>
                      <Badge tone={sub.tone}>{sub.text}</Badge>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(user.planRenewsAt)}</td>
                    <td className={`${td} text-muted font-mono text-xs`}>
                      {user.stripeCustomerId ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
