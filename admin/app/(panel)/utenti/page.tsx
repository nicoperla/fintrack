import Link from "next/link";
import { Download, Search } from "lucide-react";
import { formatDate, relativeDays } from "@/lib/format";
import {
  filtersHref,
  listUsers,
  readFilters,
  subscriptionLabel,
  type UserFilters,
} from "@/lib/users";
import {
  Badge,
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

export const metadata = { title: "Utenti" };

type SearchParams = Record<string, string | string[] | undefined>;

const SELECTS: { name: keyof UserFilters; label: string; options: [string, string][] }[] = [
  {
    name: "plan",
    label: "Piano",
    options: [
      ["", "Tutti i piani"],
      ["FREE", "Free"],
      ["PRO", "Pro"],
    ],
  },
  {
    name: "status",
    label: "Abbonamento",
    options: [
      ["", "Ogni stato"],
      ["active", "Attivo"],
      ["trialing", "In prova"],
      ["past_due", "Pagamento fallito"],
      ["canceled", "Disdetto"],
      ["comp", "Omaggio"],
      ["none", "Mai abbonato"],
    ],
  },
  {
    name: "verified",
    label: "Email",
    options: [
      ["", "Email: tutte"],
      ["yes", "Confermata"],
      ["no", "Da confermare"],
    ],
  },
  {
    name: "twofa",
    label: "2FA",
    options: [
      ["", "2FA: tutti"],
      ["yes", "Con 2FA"],
      ["no", "Senza 2FA"],
    ],
  },
  {
    name: "suspended",
    label: "Stato",
    options: [
      ["", "Stato: tutti"],
      ["no", "Attivi"],
      ["yes", "Sospesi"],
    ],
  },
  {
    name: "sort",
    label: "Ordine",
    options: [
      ["new", "Più recenti"],
      ["old", "Meno recenti"],
      ["email", "Email A-Z"],
      ["name", "Nome A-Z"],
    ],
  },
];

export default async function UsersPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const filters = readFilters(searchParams);
  const { rows, total, pages } = await listUsers(filters);
  const exportHref = filtersHref(filters, {}, "/utenti/export");

  return (
    <>
      <PageTitle
        title="Utenti"
        text={total === 1 ? "1 account trovato." : `${total} account trovati.`}
        action={
          <a href={exportHref} className={buttonClass("secondary")}>
            <Download /> Esporta CSV
          </a>
        }
      />

      {searchParams.deleted && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300"
        >
          Utente eliminato. L&apos;operazione è nel registro.
        </p>
      )}
      <Card className="mb-6">
        {/* A plain GET form: the filters live in the URL. */}
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/utenti">
          <label className="relative sm:col-span-2 lg:col-span-4">
            <span className="sr-only">Cerca</span>
            <Search
              className="text-muted pointer-events-none absolute top-2.5 left-3 size-4"
              aria-hidden
            />
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Email, nome, ID utente o ID cliente Stripe"
              className={`${inputClass} pl-9`}
            />
          </label>
          {SELECTS.map((select) => (
            <label key={select.name} className="grid gap-1 text-xs">
              <span className="text-muted">{select.label}</span>
              <select
                name={select.name}
                defaultValue={String(filters[select.name])}
                className={inputClass}
              >
                {select.options.map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="flex items-end gap-2">
            <button className={buttonClass("primary")}>Filtra</button>
            <Link href="/utenti" className={buttonClass("ghost")}>
              Azzera
            </Link>
          </div>
        </form>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <Empty>Nessun utente con questi filtri.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Utente</th>
                <th className={th}>Piano</th>
                <th className={th}>Sicurezza</th>
                <th className={th}>Iscritto</th>
                <th className={th}>Ultimo accesso</th>
                <th className={`${th} text-right`}>Movimenti</th>
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
                        <span className="block truncate font-medium text-white">
                          {user.name || "—"}
                        </span>
                        <span className="text-muted block truncate text-xs">{user.email}</span>
                      </Link>
                    </td>
                    <td className={td}>
                      <Badge tone={sub.tone}>{sub.text}</Badge>
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        {user.suspendedAt && <Badge tone="red">Sospeso</Badge>}
                        {user.twoFactorEnabledAt && <Badge tone="green">2FA</Badge>}
                        {!user.emailVerifiedAt && <Badge tone="amber">Email da confermare</Badge>}
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(user.createdAt)}</td>
                    <td className={`${td} text-muted whitespace-nowrap`}>
                      {relativeDays(user.knownDevices[0]?.lastLoginAt)}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{user._count.transactions}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {pages > 1 && (
          <nav aria-label="Pagine" className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">
              Pagina {filters.page} di {pages}
            </span>
            <div className="flex gap-2">
              {filters.page > 1 && (
                <LinkButton small href={filtersHref(filters, { page: filters.page - 1 })}>
                  Precedente
                </LinkButton>
              )}
              {filters.page < pages && (
                <LinkButton small href={filtersHref(filters, { page: filters.page + 1 })}>
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
