import Link from "next/link";
import { notFound } from "next/navigation";
import type Stripe from "stripe";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CreditCard,
  ExternalLink,
  Gift,
  KeyRound,
  LogOut,
  Mail,
  RotateCcw,
  ShieldOff,
  StickyNote,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { actionLabel } from "@/lib/audit";
import { emailConfigured, stripeConfigured } from "@/lib/config";
import { formatDate, formatDateTime, formatMoney, onDate, sinceDate } from "@/lib/format";
import { subscriptionLabel } from "@/lib/users";
import { customerSubscriptions, dashboardUrl, monthlyAmount } from "@/lib/stripe";
import { ActionDialog } from "@/components/action-dialog";
import { Badge, Card, Empty, Field, inputClass } from "@/components/ui";
import {
  addNote,
  cancelSubscription,
  deleteNote,
  deleteUser,
  grantPro,
  reactivateUser,
  resetUserTwoFactor,
  resumeSubscription,
  revokePro,
  revokeUserSessions,
  sendUserPasswordReset,
  suspendUser,
  verifyUserEmail,
} from "./actions";

export const metadata = { title: "Utente" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-line/50 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b py-2 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right break-words text-white">{children}</dd>
    </div>
  );
}

async function stripeSubscriptions(customerId: string | null) {
  if (!customerId || !stripeConfigured()) return null;
  try {
    return await customerSubscriptions(customerId);
  } catch (error) {
    console.error("[admin] Stripe non raggiungibile", error);
    return "error" as const;
  }
}

const CodeField = () => (
  <Field
    label="Il tuo codice di verifica"
    name="code"
    inputMode="numeric"
    autoComplete="one-time-code"
    placeholder="123456"
    hint="Dall'app di autenticazione: per le azioni che non si possono annullare."
    required
  />
);

export default async function UserPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      memberships: {
        orderBy: { joinedAt: "asc" },
        include: {
          household: {
            select: {
              id: true,
              name: true,
              currency: true,
              createdAt: true,
              ownerId: true,
              _count: { select: { members: true, transactions: true } },
            },
          },
        },
      },
      knownDevices: { orderBy: { lastLoginAt: "desc" } },
      adminNotes: {
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { name: true } } },
      },
      _count: {
        select: {
          accounts: true,
          transactions: true,
          budgets: true,
          goals: true,
          debts: true,
          claims: true,
          pacts: true,
          recoveryCodes: true,
        },
      },
    },
  });
  if (!user) notFound();

  const [logs, subscriptions] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: { targetUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { admin: { select: { name: true } } },
    }),
    stripeSubscriptions(user.stripeCustomerId),
  ]);

  const sub = subscriptionLabel(user);
  const paying =
    user.subscriptionStatus !== null &&
    ["active", "trialing", "past_due"].includes(user.subscriptionStatus);
  const id = user.id;

  return (
    <>
      <Link
        href="/utenti"
        className="text-muted mb-4 inline-flex items-center gap-1 text-sm hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden /> Utenti
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-white">{user.name || user.email}</h1>
          <p className="text-muted truncate text-sm">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={sub.tone}>{sub.text}</Badge>
            {user.suspendedAt && <Badge tone="red">Sospeso</Badge>}
            {user.twoFactorEnabledAt ? (
              <Badge tone="green">2FA attiva</Badge>
            ) : (
              <Badge>Senza 2FA</Badge>
            )}
            {user.emailVerifiedAt ? (
              <Badge tone="green">Email confermata</Badge>
            ) : (
              <Badge tone="amber">Email da confermare</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.suspendedAt ? (
            <ActionDialog
              label="Riattiva"
              icon={<Undo2 />}
              title="Riattivare l'account?"
              description="L'utente potrà di nuovo accedere a FinTrack."
              confirmLabel="Riattiva"
              action={reactivateUser.bind(null, id)}
            />
          ) : (
            <ActionDialog
              label="Sospendi"
              icon={<Ban />}
              variant="danger"
              title="Sospendere l'account?"
              description="L'utente viene disconnesso subito e non può più accedere. I suoi dati restano; puoi riattivarlo quando vuoi."
              confirmLabel="Sospendi"
              confirmVariant="danger"
              action={suspendUser.bind(null, id)}
            >
              <Field label="Motivo (resta nel registro)" name="reason" maxLength={300} required />
            </ActionDialog>
          )}
        </div>
      </div>

      {user.suspendedAt && (
        <p className="mb-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          Sospeso {onDate(user.suspendedAt, true)}
          {user.suspendedReason ? `: ${user.suspendedReason}` : "."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <dl>
            <Row label="ID">
              <code className="font-mono text-xs">{user.id}</code>
            </Row>
            <Row label="Iscritto">{formatDateTime(user.createdAt)}</Row>
            <Row label="Termini accettati">{formatDate(user.termsAcceptedAt)}</Row>
            <Row label="Email confermata">
              {user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : "No"}
            </Row>
            <Row label="Coach AI">
              {user.aiConsentAt ? `Consenso ${sinceDate(user.aiConsentAt)}` : "Spento"}
            </Row>
            <Row label="Riepilogo settimanale">{user.weeklyDigest ? "Attivo" : "Spento"}</Row>
            <Row label="Ultimo aggiornamento">{formatDateTime(user.updatedAt)}</Row>
          </dl>
        </Card>

        <Card title="Abbonamento">
          <dl>
            <Row label="Piano">
              <Badge tone={sub.tone}>{sub.text}</Badge>
            </Row>
            <Row label={user.subscriptionStatus === "comp" ? "Omaggio fino al" : "Rinnovo"}>
              {formatDate(user.planRenewsAt)}
              {user.planCancelsAtEnd && user.subscriptionStatus !== "comp" ? " (poi finisce)" : ""}
            </Row>
            <Row label="Cliente Stripe">
              {user.stripeCustomerId ? (
                stripeConfigured() ? (
                  <a
                    href={dashboardUrl(`customers/${user.stripeCustomerId}`)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent inline-flex items-center gap-1 hover:underline"
                  >
                    {user.stripeCustomerId} <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : (
                  <code className="font-mono text-xs">{user.stripeCustomerId}</code>
                )
              ) : (
                "—"
              )}
            </Row>
          </dl>
          {subscriptions === "error" && (
            <p className="mt-3 text-sm text-amber-300">Stripe non risponde: riprova tra poco.</p>
          )}
          {Array.isArray(subscriptions) && subscriptions.length > 0 && (
            <ul className="mt-3 grid gap-2">
              {subscriptions.map((s: Stripe.Subscription) => (
                <li key={s.id} className="bg-ink rounded-lg px-3 py-2 text-xs">
                  <span className="font-mono">{s.id}</span> · {s.status}
                  {s.cancel_at_period_end ? " · disdetto" : ""} ·{" "}
                  {formatMoney(monthlyAmount(s), s.currency.toUpperCase())}/mese
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {user.subscriptionStatus === "comp" ? (
              <ActionDialog
                small
                label="Togli l'omaggio"
                icon={<XCircle />}
                title="Togliere Pro in omaggio?"
                description="L'utente torna subito al piano gratuito."
                confirmLabel="Togli"
                confirmVariant="danger"
                action={revokePro.bind(null, id)}
              />
            ) : (
              !paying && (
                <ActionDialog
                  small
                  label="Regala Pro"
                  icon={<Gift />}
                  title="Regalare Pro?"
                  description="Pro senza pagare fino alla data scelta, poi torna gratis da solo. L'utente può abbonarsi per tenerlo."
                  confirmLabel="Regala"
                  action={grantPro.bind(null, id)}
                >
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-slate-200">Per quanto</span>
                    <select name="days" defaultValue="30" className={inputClass}>
                      <option value="7">7 giorni</option>
                      <option value="30">1 mese</option>
                      <option value="90">3 mesi</option>
                      <option value="180">6 mesi</option>
                      <option value="365">1 anno</option>
                    </select>
                  </label>
                </ActionDialog>
              )
            )}
            {paying && user.stripeCustomerId && stripeConfigured() && (
              <>
                {user.planCancelsAtEnd ? (
                  <ActionDialog
                    small
                    label="Annulla la disdetta"
                    icon={<RotateCcw />}
                    title="Annullare la disdetta?"
                    description="L'abbonamento torna a rinnovarsi a fine periodo."
                    confirmLabel="Annulla la disdetta"
                    action={resumeSubscription.bind(null, id)}
                  />
                ) : (
                  <ActionDialog
                    small
                    label="Disdici"
                    icon={<CreditCard />}
                    variant="danger"
                    title="Disdire l'abbonamento?"
                    description="A fine periodo l'utente resta Pro fino alla scadenza già pagata. Subito: perde Pro ora, senza rimborso automatico (i rimborsi si fanno da Stripe)."
                    confirmLabel="Disdici"
                    confirmVariant="danger"
                    action={cancelSubscription.bind(null, id)}
                  >
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium text-slate-200">Quando</span>
                      <select name="mode" defaultValue="end" className={inputClass}>
                        <option value="end">A fine periodo</option>
                        <option value="now">Subito</option>
                      </select>
                    </label>
                  </ActionDialog>
                )}
              </>
            )}
          </div>
        </Card>

        <Card title="Sicurezza">
          <dl>
            <Row label="Verifica in due passaggi">
              {user.twoFactorEnabledAt
                ? `Attiva ${sinceDate(user.twoFactorEnabledAt)} · ${user._count.recoveryCodes} codici di recupero`
                : "Non attiva"}
            </Row>
          </dl>
          <h3 className="text-muted mt-4 mb-2 text-xs font-medium uppercase">Dispositivi</h3>
          {user.knownDevices.length === 0 ? (
            <p className="text-muted text-sm">Nessun accesso registrato.</p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {user.knownDevices.map((device) => (
                <li
                  key={device.deviceHash}
                  className="bg-ink flex flex-wrap justify-between gap-x-3 rounded-lg px-3 py-2"
                >
                  <span className="text-white">
                    {device.label}
                    {device.place ? <span className="text-muted"> · {device.place}</span> : null}
                  </span>
                  <span className="text-muted text-xs">
                    ultimo accesso {formatDateTime(device.lastLoginAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionDialog
              small
              label="Chiudi le sessioni"
              icon={<LogOut />}
              title="Chiudere tutte le sessioni?"
              description="L'utente viene disconnesso da tutti i dispositivi e deve accedere di nuovo."
              confirmLabel="Chiudi le sessioni"
              action={revokeUserSessions.bind(null, id)}
            />
            <ActionDialog
              small
              label="Invia reset password"
              icon={<Mail />}
              disabled={!emailConfigured()}
              title="Inviare il link di reset?"
              description={`Arriva a ${user.email} il link per scegliere una nuova password (valido 1 ora). La password attuale non cambia finché non lo usa.`}
              confirmLabel="Invia"
              action={sendUserPasswordReset.bind(null, id)}
            />
            {!user.emailVerifiedAt && (
              <ActionDialog
                small
                label="Conferma l'email"
                icon={<BadgeCheck />}
                title="Confermare l'email a mano?"
                description="Fallo solo se sei sicuro che l'indirizzo sia suo (per esempio ti ha scritto da lì)."
                confirmLabel="Conferma"
                action={verifyUserEmail.bind(null, id)}
              />
            )}
            {user.twoFactorEnabledAt && (
              <ActionDialog
                small
                label="Azzera il 2FA"
                icon={<ShieldOff />}
                variant="danger"
                title="Azzerare la verifica in due passaggi?"
                description="Solo per chi ha perso telefono e codici di recupero, dopo aver verificato che sia davvero lui: chi ha la password potrà entrare senza codice."
                confirmLabel="Azzera"
                confirmVariant="danger"
                action={resetUserTwoFactor.bind(null, id)}
              >
                <CodeField />
              </ActionDialog>
            )}
          </div>
          {!emailConfigured() && (
            <p className="text-muted mt-3 text-xs">
              Per inviare email agli utenti imposta RESEND_API_KEY, EMAIL_FROM e FINTRACK_URL nel
              pannello.
            </p>
          )}
        </Card>

        <Card title="Dati">
          <p className="text-muted mb-3 text-xs">
            Solo i conteggi: i movimenti e gli importi restano privati anche per l&apos;assistenza.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-4">
            {[
              ["Conti", user._count.accounts],
              ["Movimenti", user._count.transactions],
              ["Budget", user._count.budgets],
              ["Obiettivi", user._count.goals],
              ["Debiti", user._count.debts],
              ["Pratiche", user._count.claims],
              ["Patti", user._count.pacts],
              ["Spazi", user.memberships.length],
            ].map(([label, value]) => (
              <div key={label} className="bg-ink rounded-lg px-2 py-2">
                <p className="text-lg font-semibold text-white tabular-nums">{value}</p>
                <p className="text-muted text-xs">{label}</p>
              </div>
            ))}
          </div>
          <h3 className="text-muted mt-4 mb-2 text-xs font-medium uppercase">Spazi</h3>
          <ul className="grid gap-1.5 text-sm">
            {user.memberships.map(({ household, role }) => (
              <li
                key={household.id}
                className="bg-ink flex flex-wrap justify-between gap-x-3 rounded-lg px-3 py-2"
              >
                <span className="text-white">
                  {household.name} <span className="text-muted">· {household.currency}</span>
                </span>
                <span className="text-muted text-xs">
                  {role === "OWNER" ? "proprietario" : "membro"} · {household._count.members}{" "}
                  {household._count.members === 1 ? "persona" : "persone"} ·{" "}
                  {household._count.transactions} movimenti
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Note interne"
          action={
            <ActionDialog
              small
              label="Aggiungi nota"
              icon={<StickyNote />}
              title="Nuova nota"
              description="Visibile solo nel pannello. Va via con l'account."
              confirmLabel="Salva"
              action={addNote.bind(null, id)}
            >
              <textarea
                name="text"
                rows={4}
                maxLength={2000}
                required
                className={`${inputClass} h-auto py-2`}
              />
            </ActionDialog>
          }
        >
          {user.adminNotes.length === 0 ? (
            <Empty>Nessuna nota.</Empty>
          ) : (
            <ul className="grid gap-2">
              {user.adminNotes.map((note) => (
                <li key={note.id} className="bg-ink rounded-lg px-3 py-2 text-sm">
                  <p className="whitespace-pre-wrap text-white">{note.text}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-muted text-xs">
                      {note.admin?.name ?? "admin"} · {formatDateTime(note.createdAt)}
                    </span>
                    <ActionDialog
                      small
                      variant="ghost"
                      label="Elimina"
                      title="Eliminare la nota?"
                      confirmLabel="Elimina"
                      confirmVariant="danger"
                      action={deleteNote.bind(null, id, note.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Registro">
          {logs.length === 0 ? (
            <Empty>Nessuna operazione su questo utente.</Empty>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {logs.map((log) => (
                <li key={log.id} className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-white">{actionLabel(log.action)}</span>
                  <span className="text-muted text-xs">
                    {log.admin?.name ?? "—"} · {formatDateTime(log.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Zona pericolosa" className="mt-6 border-red-400/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted max-w-xl text-sm">
            Elimina per sempre l&apos;account, i suoi spazi personali e le sue pratiche, e disdice
            l&apos;abbonamento. Negli spazi condivisi i dati restano agli altri membri. Non si può
            annullare.
          </p>
          <ActionDialog
            label="Elimina utente"
            icon={<Trash2 />}
            variant="danger"
            title="Eliminare l'utente per sempre?"
            description={
              <>
                Scrivi <strong className="text-white">{user.email}</strong> per confermare.
              </>
            }
            confirmLabel="Elimina per sempre"
            confirmVariant="danger"
            action={deleteUser.bind(null, id)}
          >
            <Field label="Email dell'utente" name="confirm" autoComplete="off" required />
            <CodeField />
          </ActionDialog>
        </div>
      </Card>

      <p className="text-muted mt-6 flex items-center gap-1.5 text-xs">
        <KeyRound className="size-3.5" aria-hidden /> Ogni operazione resta nel registro con il tuo
        nome, la data e l&apos;IP.
      </p>
    </>
  );
}
