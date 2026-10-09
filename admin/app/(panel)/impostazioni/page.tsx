import { KeyRound, LogOut, RefreshCw } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { ActionDialog } from "@/components/action-dialog";
import { Card, Field, PageTitle } from "@/components/ui";
import { changeAdminPassword, regenerateAdminCodes, signOutAdminEverywhere } from "./actions";

export const metadata = { title: "Impostazioni" };

const CodeField = () => (
  <Field
    label="Codice di verifica"
    name="code"
    inputMode="numeric"
    autoComplete="one-time-code"
    placeholder="123456"
    hint="Dall'app di autenticazione, o un codice di recupero."
    required
  />
);

export default async function SettingsPage() {
  const session = await requireAdmin();
  const admin = await prisma.adminUser.findUniqueOrThrow({
    where: { id: session.id },
    select: { name: true, email: true, createdAt: true, lastLoginAt: true, recoveryCodes: true },
  });

  return (
    <>
      <PageTitle title="Impostazioni" text="Il tuo account amministratore." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Nome</dt>
              <dd>{admin.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Email</dt>
              <dd className="truncate">{admin.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Admin dal</dt>
              <dd>{formatDateTime(admin.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Accesso attuale</dt>
              <dd>{formatDateTime(admin.lastLoginAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Codici di recupero</dt>
              <dd className={admin.recoveryCodes.length < 3 ? "text-amber-300" : ""}>
                {admin.recoveryCodes.length} rimasti
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Sicurezza">
          <div className="grid gap-3">
            <ActionDialog
              label="Cambia password"
              icon={<KeyRound />}
              title="Cambia password"
              description="Le altre sessioni del pannello vengono chiuse."
              confirmLabel="Cambia"
              action={changeAdminPassword}
            >
              <Field
                label="Password attuale"
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
              <Field
                label="Nuova password"
                name="password"
                type="password"
                autoComplete="new-password"
                hint="Almeno 12 caratteri."
                required
              />
              <Field
                label="Ripeti la nuova password"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
              />
              <CodeField />
            </ActionDialog>
            <ActionDialog
              label="Nuovi codici di recupero"
              icon={<RefreshCw />}
              title="Nuovi codici di recupero"
              description="Quelli di prima smettono di funzionare."
              confirmLabel="Crea"
              action={regenerateAdminCodes}
              showCodes
            >
              <Field
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
              <CodeField />
            </ActionDialog>
            <ActionDialog
              label="Esci dagli altri dispositivi"
              icon={<LogOut />}
              title="Chiudere le altre sessioni?"
              description="Resti connesso solo da questo browser."
              confirmLabel="Chiudi le altre"
              action={signOutAdminEverywhere}
            />
          </div>
          <p className="text-muted mt-4 text-xs">
            Le sessioni del pannello durano 8 ore. Se perdi telefono e codici di recupero, si
            ricomincia dal setup: svuota la tabella admin_users dal database e imposta di nuovo
            ADMIN_SETUP_TOKEN.
          </p>
        </Card>
      </div>
    </>
  );
}
