import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import { prisma } from "@/lib/db";
import { allowedIps, emailConfigured, fintrackUrl, stripeConfigured } from "@/lib/config";
import { stripeTestMode } from "@/lib/stripe";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Card, PageTitle, Table, td, th } from "@/components/ui";

export const metadata = { title: "Sistema" };

function Check({
  state,
  title,
  text,
}: {
  state: "ok" | "warn" | "off";
  title: string;
  text: string;
}) {
  const Icon = state === "ok" ? CheckCircle2 : state === "warn" ? CircleAlert : CircleDashed;
  return (
    <li className="flex gap-3 py-2.5">
      <Icon
        className={`mt-0.5 size-5 shrink-0 ${state === "ok" ? "text-emerald-400" : state === "warn" ? "text-amber-300" : "text-slate-500"}`}
        aria-hidden
      />
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-muted text-sm">{text}</p>
      </div>
    </li>
  );
}

/** Row counts through Prisma: typed, so a renamed table fails the build, not the page. */
const TABLES: [label: string, count: () => Promise<number>][] = [
  ["Utenti", () => prisma.user.count()],
  ["Spazi", () => prisma.household.count()],
  ["Conti", () => prisma.financialAccount.count()],
  ["Movimenti", () => prisma.transaction.count()],
  ["Pratiche di Riprenditeli", () => prisma.claim.count()],
  ["Dispositivi", () => prisma.knownDevice.count()],
  ["Contatori anti-abuso", () => prisma.rateLimit.count()],
  ["Accessi a metà", () => prisma.loginTicket.count()],
  ["Registro admin", () => prisma.adminAuditLog.count()],
];

export default async function SystemPage() {
  const [counts, size, migrations] = await Promise.all([
    Promise.all(TABLES.map(([, count]) => count())),
    prisma.$queryRaw<
      { size: string }[]
    >`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
    prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT "migration_name", "finished_at" FROM "_prisma_migrations"
      ORDER BY "finished_at" DESC NULLS FIRST LIMIT 5`,
  ]);
  const ips = allowedIps();
  const setupTokenLeft = Boolean(process.env.ADMIN_SETUP_TOKEN);

  return (
    <>
      <PageTitle title="Sistema" text="Configurazione del pannello e stato del database." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Configurazione">
          <ul className="divide-line/60 divide-y">
            <Check
              state={stripeConfigured() ? "ok" : "off"}
              title="Stripe"
              text={
                stripeConfigured()
                  ? `Collegato${stripeTestMode() ? " in modalità test" : " in modalità live"}: abbonamenti e incassi dal vivo.`
                  : "Non collegato: abbonamenti solo dal database, niente incassi."
              }
            />
            <Check
              state={emailConfigured() ? "ok" : "off"}
              title="Email agli utenti"
              text={
                emailConfigured()
                  ? `Resend attivo, link verso ${fintrackUrl()}.`
                  : "Spente: servono RESEND_API_KEY, EMAIL_FROM e FINTRACK_URL."
              }
            />
            <Check
              state={ips.length ? "ok" : "warn"}
              title="IP ammessi"
              text={
                ips.length
                  ? `Solo ${ips.join(", ")}.`
                  : "Tutti gli IP vedono la pagina di accesso. Con ADMIN_ALLOWED_IPS il pannello è invisibile agli altri."
              }
            />
            <Check
              state={setupTokenLeft ? "warn" : "ok"}
              title="Codice di setup"
              text={
                setupTokenLeft
                  ? "ADMIN_SETUP_TOKEN è ancora impostato: il setup è chiuso, ma toglilo dalle variabili d'ambiente."
                  : "Rimosso, come deve essere dopo il setup."
              }
            />
          </ul>
        </Card>
        <Card title={`Database · ${size[0]?.size ?? "—"}`}>
          <table className="w-full text-sm">
            <tbody>
              {TABLES.map(([label], i) => (
                <tr key={label}>
                  <td className={td}>{label}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatNumber(counts[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Ultime migrazioni" className="lg:col-span-2">
          <Table>
            <thead>
              <tr>
                <th className={th}>Migrazione</th>
                <th className={th}>Applicata</th>
              </tr>
            </thead>
            <tbody>
              {migrations.map((m) => (
                <tr key={m.migration_name}>
                  <td className={`${td} font-mono text-xs`}>{m.migration_name}</td>
                  <td className={td}>
                    {m.finished_at ? formatDateTime(m.finished_at) : "in corso o fallita"}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
