import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/reports/digest";

/*
 * Security notices: a new browser signed in, the password or 2FA changed, a wrong code after
 * the right password. They never block the action they describe: a failed send is only logged.
 */

type Recipient = { email: string; name?: string | null };

export type SignInPlace = { device: string; place: string | null; at?: Date };

const when = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

function describe({ device, place, at = new Date() }: SignInPlace) {
  return `${device}${place ? `, da ${place}` : ""}, il ${when.format(at)}`;
}

async function notify(user: Recipient, subject: string, lines: string[]) {
  const hello = user.name ? `Ciao ${user.name.split(" ")[0]},` : "Ciao,";
  const resetLink = `${getAppUrl()}/forgot-password`;
  const settingsLink = `${getAppUrl()}/settings#sicurezza`;
  const text = [
    hello,
    "",
    ...lines,
    "",
    `Se non sei stato tu, reimposta subito la password: ${resetLink}`,
    `Poi controlla la verifica in due passaggi e i dispositivi da Impostazioni › Sicurezza: ${settingsLink}`,
  ].join("\n");
  const html = [
    `<p>${escapeHtml(hello)}</p>`,
    ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
    `<p>Se non sei stato tu, <a href="${resetLink}">reimposta subito la password</a>, poi controlla la verifica in due passaggi e i dispositivi da <a href="${settingsLink}">Impostazioni › Sicurezza</a>.</p>`,
  ].join("");
  try {
    await sendEmail({ to: user.email, subject, text, html });
  } catch (error) {
    console.error(`[security] invio email «${subject}» fallito`, error);
  }
}

export const notifyNewDevice = (user: Recipient, where: SignInPlace) =>
  notify(user, "Nuovo accesso al tuo account FinTrack", [
    `È stato fatto un accesso al tuo account da un dispositivo che non avevamo mai visto: ${describe(where)}.`,
    "Se sei stato tu, non devi fare niente.",
  ]);

export const notifyWrongCode = (user: Recipient, where: SignInPlace) =>
  notify(user, "Qualcuno conosce la tua password FinTrack", [
    `Qualcuno ha inserito la password giusta del tuo account, ma codici di verifica sbagliati: ${describe(where)}.`,
    "La verifica in due passaggi l'ha fermato. Se non eri tu, la tua password non è più segreta: cambiala adesso.",
  ]);

export const notifyPasswordChanged = (user: Recipient) =>
  notify(user, "La tua password FinTrack è cambiata", [
    "La password del tuo account è appena stata cambiata, e abbiamo chiuso le sessioni aperte sugli altri dispositivi.",
  ]);

export const notifyTwoFactor = (user: Recipient, enabled: boolean) =>
  notify(
    user,
    enabled ? "Verifica in due passaggi attivata" : "Verifica in due passaggi disattivata",
    enabled
      ? [
          "Da ora, per entrare in FinTrack servono la password e il codice dell'app di autenticazione.",
          "Tieni i codici di recupero in un posto sicuro: servono se perdi il telefono.",
        ]
      : [
          "La verifica in due passaggi del tuo account è stata disattivata: per entrare basta di nuovo la password.",
        ],
  );

export const notifyRecoveryCodeUsed = (user: Recipient, remaining: number, where: SignInPlace) =>
  notify(user, "Hai usato un codice di recupero", [
    `Per entrare nel tuo account è stato usato un codice di recupero: ${describe(where)}.`,
    remaining > 0
      ? `Ti ${remaining === 1 ? "resta 1 codice" : `restano ${remaining} codici`}. Se hai perso il telefono, da Impostazioni › Sicurezza disattiva e riattiva la verifica in due passaggi per collegare quello nuovo.`
      : "Non ti restano codici di recupero: creane di nuovi da Impostazioni › Sicurezza.",
  ]);
