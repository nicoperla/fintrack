import Link from "next/link";
import type Stripe from "stripe";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { stripeConfigured } from "@/lib/config";
import { formatDate, formatMoney } from "@/lib/format";
import { dashboardUrl, stripe, stripeTestMode } from "@/lib/stripe";
import { Badge, Card, Empty, PageTitle, Stat, Table, td, th, type Tone } from "@/components/ui";

export const metadata = { title: "Pagamenti" };

const STATUS: Record<string, { text: string; tone: Tone }> = {
  paid: { text: "Pagata", tone: "green" },
  open: { text: "Da pagare", tone: "amber" },
  uncollectible: { text: "Non incassabile", tone: "red" },
  void: { text: "Annullata", tone: "neutral" },
  draft: { text: "Bozza", tone: "neutral" },
};

const monthKey = (seconds: number) =>
  new Intl.DateTimeFormat("it-IT", {
    month: "short",
    year: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(seconds * 1000));

export default async function PaymentsPage() {
  if (!stripeConfigured()) {
    return (
      <>
        <PageTitle title="Pagamenti" />
        <Card>
          <p className="text-muted text-sm">
            Stripe non è collegato al pannello. Aggiungi <code>STRIPE_SECRET_KEY</code> (la stessa
            di FinTrack) nelle variabili d&apos;ambiente del pannello per vedere fatture e incassi.
          </p>
        </Card>
      </>
    );
  }

  let invoices: Stripe.Invoice[] = [];
  let failed = false;
  try {
    invoices = (await stripe().invoices.list({ limit: 100 })).data;
  } catch (error) {
    console.error("[admin] fatture non disponibili", error);
    failed = true;
  }

  const customers = [
    ...new Set(
      invoices
        .map((i) => (typeof i.customer === "string" ? i.customer : i.customer?.id))
        .filter(Boolean),
    ),
  ] as string[];
  const users = await prisma.user.findMany({
    where: { stripeCustomerId: { in: customers } },
    select: { id: true, email: true, stripeCustomerId: true },
  });
  const byCustomer = new Map(users.map((u) => [u.stripeCustomerId, u]));

  const paid = invoices.filter((i) => i.status === "paid");
  const currency = (paid[0]?.currency ?? "eur").toUpperCase();
  const thisMonth = monthKey(Date.now() / 1000);
  const months = new Map<string, number>();
  for (const invoice of paid) {
    const key = monthKey(invoice.created);
    months.set(key, (months.get(key) ?? 0) + invoice.amount_paid / 100);
  }
  const open = invoices.filter((i) => i.status === "open");

  return (
    <>
      <PageTitle
        title="Pagamenti"
        text={`Le ultime 100 fatture da Stripe${stripeTestMode() ? " (modalità test)" : ""}. Rimborsi e note di credito si fanno da Stripe.`}
        action={
          <a
            href={dashboardUrl("payments")}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent inline-flex items-center gap-1 text-sm hover:underline"
          >
            Apri Stripe <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
      />
      {failed ? (
        <Card>
          <p className="text-sm text-amber-300">Stripe non risponde: riprova tra poco.</p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Incassato questo mese"
              tone="accent"
              value={formatMoney(months.get(thisMonth) ?? 0, currency)}
            />
            <Stat
              label="Incassato (ultime 100)"
              value={formatMoney(
                paid.reduce((s, i) => s + i.amount_paid / 100, 0),
                currency,
              )}
            />
            <Stat label="Fatture pagate" value={paid.length} />
            <Stat
              label="Da incassare"
              value={open.length}
              tone={open.length ? "warn" : undefined}
            />
          </div>

          {months.size > 0 && (
            <Card title="Incassi per mese" className="mb-6">
              <ul className="grid gap-2">
                {[...months.entries()].map(([month, amount]) => {
                  const max = Math.max(...months.values());
                  return (
                    <li
                      key={month}
                      className="grid grid-cols-[4rem_1fr_6rem] items-center gap-3 text-sm"
                    >
                      <span className="text-muted">{month}</span>
                      <span className="bg-ink h-2.5 overflow-hidden rounded-full">
                        <span
                          className="bg-accent block h-full rounded-full"
                          style={{ width: `${(amount / max) * 100}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">
                        {formatMoney(amount, currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card title="Fatture">
            {invoices.length === 0 ? (
              <Empty>Ancora nessuna fattura.</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Data</th>
                    <th className={th}>Cliente</th>
                    <th className={th}>Stato</th>
                    <th className={`${th} text-right`}>Importo</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const customerId =
                      typeof invoice.customer === "string"
                        ? invoice.customer
                        : invoice.customer?.id;
                    const user = customerId ? byCustomer.get(customerId) : undefined;
                    const status = STATUS[invoice.status ?? ""] ?? {
                      text: invoice.status ?? "—",
                      tone: "neutral" as Tone,
                    };
                    return (
                      <tr key={invoice.id}>
                        <td className={`${td} whitespace-nowrap`}>
                          {formatDate(new Date(invoice.created * 1000))}
                        </td>
                        <td className={td}>
                          {user ? (
                            <Link href={`/utenti/${user.id}`} className="hover:underline">
                              {user.email}
                            </Link>
                          ) : (
                            <span className="text-muted">
                              {invoice.customer_email ?? customerId ?? "—"}
                            </span>
                          )}
                        </td>
                        <td className={td}>
                          <Badge tone={status.tone}>{status.text}</Badge>
                        </td>
                        <td className={`${td} text-right tabular-nums`}>
                          {formatMoney(invoice.total / 100, invoice.currency.toUpperCase())}
                        </td>
                        <td className={`${td} text-right`}>
                          {invoice.hosted_invoice_url && (
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-accent text-xs hover:underline"
                            >
                              Fattura
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </>
  );
}
