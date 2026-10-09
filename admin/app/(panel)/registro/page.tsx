import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ACTIONS, actionLabel } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import {
  buttonClass,
  Card,
  Empty,
  inputClass,
  LinkButton,
  PageTitle,
  Table,
  td,
  th,
} from "@/components/ui";

export const metadata = { title: "Registro" };

const PAGE = 100;

export default async function AuditPage(props: {
  searchParams: Promise<{ action?: string; q?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const action = searchParams.action && searchParams.action in ACTIONS ? searchParams.action : "";
  const q = (searchParams.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Math.min(1000, Number.parseInt(searchParams.page ?? "1", 10) || 1));
  const where: Prisma.AdminAuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(q
      ? {
          OR: [
            { targetEmail: { contains: q, mode: "insensitive" } },
            { ip: { contains: q } },
            { admin: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { admin: { select: { name: true } } },
    }),
    prisma.adminAuditLog.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) =>
    `/registro?${new URLSearchParams({ ...(action && { action }), ...(q && { q }), page: String(p) })}`;

  return (
    <>
      <PageTitle
        title="Registro"
        text="Tutto ciò che è stato fatto dal pannello, accessi compresi. Si conserva per un anno."
      />
      <Card className="mb-6">
        <form action="/registro" className="grid gap-3 sm:grid-cols-[1fr_16rem_auto]">
          <input
            name="q"
            defaultValue={q}
            placeholder="Email dell'utente, IP o admin"
            className={inputClass}
          />
          <select name="action" defaultValue={action} className={inputClass}>
            <option value="">Tutte le operazioni</option>
            {Object.entries(ACTIONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button className={buttonClass("primary")}>Filtra</button>
        </form>
      </Card>
      <Card>
        {logs.length === 0 ? (
          <Empty>Nessuna operazione.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Quando</th>
                <th className={th}>Operazione</th>
                <th className={th}>Utente</th>
                <th className={th}>Admin</th>
                <th className={th}>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const details = log.details as Record<string, unknown> | null;
                return (
                  <tr key={log.id}>
                    <td className={`${td} text-muted whitespace-nowrap`}>
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className={td}>
                      <span
                        className={log.action.endsWith("failed") ? "text-red-300" : "text-white"}
                      >
                        {actionLabel(log.action)}
                      </span>
                      {typeof details?.reason === "string" && (
                        <span className="text-muted block text-xs">«{details.reason}»</span>
                      )}
                      {log.action === "admin.login_failed" &&
                        typeof details?.email === "string" && (
                          <span className="text-muted block text-xs">con {details.email}</span>
                        )}
                    </td>
                    <td className={`${td} max-w-[14rem] truncate`}>
                      {log.targetUserId && log.action !== "user.deleted" ? (
                        <Link href={`/utenti/${log.targetUserId}`} className="hover:underline">
                          {log.targetEmail}
                        </Link>
                      ) : (
                        <span className="text-muted">{log.targetEmail ?? "—"}</span>
                      )}
                    </td>
                    <td className={td}>{log.admin?.name ?? "—"}</td>
                    <td className={`${td} text-muted font-mono text-xs`}>{log.ip ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {pages > 1 && (
          <nav aria-label="Pagine" className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">
              Pagina {page} di {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <LinkButton small href={href(page - 1)}>
                  Precedente
                </LinkButton>
              )}
              {page < pages && (
                <LinkButton small href={href(page + 1)}>
                  Successiva
                </LinkButton>
              )}
            </div>
          </nav>
        )}
      </Card>
    </>
  );
}
