import Link from "next/link";
import { prisma } from "@/lib/db";
import { suspiciousAttempts } from "@/lib/security";
import { formatDateTime, formatNumber, formatPercent, formatTime } from "@/lib/format";
import { Badge, Card, Empty, PageTitle, Stat, Table, td, th } from "@/components/ui";

export const metadata = { title: "Sicurezza" };

export default async function SecurityPage() {
  const [attempts, users, twoFactor, suspended, devices, failedAdmin] = await Promise.all([
    suspiciousAttempts(),
    prisma.user.count(),
    prisma.user.count({ where: { twoFactorEnabledAt: { not: null } } }),
    prisma.user.findMany({
      where: { suspendedAt: { not: null } },
      orderBy: { suspendedAt: "desc" },
      select: { id: true, email: true, suspendedAt: true, suspendedReason: true },
    }),
    prisma.knownDevice.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { user: { select: { id: true, email: true } } },
    }),
    prisma.adminAuditLog.count({
      where: {
        action: "admin.login_failed",
        createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
      },
    }),
  ]);
  const userIds = attempts.flatMap((a) => (a.userId ? [a.userId] : []));
  const emails = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
      })
    ).map((u) => [u.id, u.email]),
  );
  const blocked = attempts.filter((a) => a.blocked).length;

  return (
    <>
      <PageTitle
        title="Sicurezza"
        text="Tentativi di accesso sospetti, account bloccati, nuovi dispositivi."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Bloccati adesso"
          value={blocked}
          tone={blocked ? "warn" : undefined}
          hint="per troppi tentativi"
        />
        <Stat
          label="Utenti con 2FA"
          value={formatPercent(twoFactor, users)}
          hint={`${formatNumber(twoFactor)} su ${formatNumber(users)}`}
        />
        <Stat label="Account sospesi" value={suspended.length} />
        <Stat
          label="Accessi admin rifiutati"
          value={failedAdmin}
          tone={failedAdmin ? "warn" : undefined}
          hint="negli ultimi 7 giorni"
        />
      </div>

      <Card title="Tentativi in corso" className="mb-6">
        <p className="text-muted mb-3 text-xs">
          Contatori con almeno metà dei tentativi consentiti già usati. Chi supera il limite resta
          bloccato fino all&apos;orario indicato, poi può riprovare.
        </p>
        {attempts.length === 0 ? (
          <Empty>Niente di sospetto in questo momento.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Cosa</th>
                <th className={th}>Chi</th>
                <th className={th}>Tentativi</th>
                <th className={th}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.key}>
                  <td className={td}>{a.label}</td>
                  <td className={`${td} max-w-[16rem] truncate`}>
                    {a.userId ? (
                      <Link href={`/utenti/${a.userId}`} className="hover:underline">
                        {emails.get(a.userId) ?? a.userId}
                      </Link>
                    ) : (
                      <span className={a.whoKind === "ip" ? "font-mono text-xs" : ""}>{a.who}</span>
                    )}
                  </td>
                  <td className={`${td} tabular-nums`}>
                    {a.count} / {a.limit}
                  </td>
                  <td className={td}>
                    {a.blocked ? (
                      <Badge tone="red">Bloccato fino alle {formatTime(a.until)}</Badge>
                    ) : (
                      <Badge tone="amber">Sotto osservazione</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Nuovi dispositivi">
          {devices.length === 0 ? (
            <Empty>Nessun accesso registrato.</Empty>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {devices.map((d) => (
                <li key={`${d.userId}-${d.deviceHash}`} className="bg-ink rounded-lg px-3 py-2">
                  <Link
                    href={`/utenti/${d.user.id}`}
                    className="block truncate text-white hover:underline"
                  >
                    {d.user.email}
                  </Link>
                  <span className="text-muted text-xs">
                    {d.label}
                    {d.place ? ` · ${d.place}` : ""} · primo accesso {formatDateTime(d.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Account sospesi">
          {suspended.length === 0 ? (
            <Empty>Nessun account sospeso.</Empty>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {suspended.map((u) => (
                <li key={u.id} className="bg-ink rounded-lg px-3 py-2">
                  <Link
                    href={`/utenti/${u.id}`}
                    className="block truncate text-white hover:underline"
                  >
                    {u.email}
                  </Link>
                  <span className="text-muted text-xs">
                    {formatDateTime(u.suspendedAt)}
                    {u.suspendedReason ? ` · ${u.suspendedReason}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
