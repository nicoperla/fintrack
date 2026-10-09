# FinTrack Admin

Il pannello di amministrazione di FinTrack: un'app separata (Next.js 15), con un suo indirizzo e
un suo accesso, che lavora sullo **stesso database** di FinTrack. Non è collegata all'app per gli
utenti: nessun link, nessuna pagina in comune.

## Cosa fa

- **Panoramica**: utenti, iscrizioni al giorno, abbonati Pro, ricavi mensili (MRR) da Stripe,
  accessi recenti, email confermate, adozione del 2FA, avvisi (pagamenti falliti, sospesi).
- **Utenti**: ricerca per email, nome, ID o cliente Stripe; filtri per piano, abbonamento, email,
  2FA e stato; esportazione CSV dei risultati.
- **Scheda utente**: account, abbonamento (con link a Stripe), sicurezza e dispositivi, conteggio
  dei dati (mai il contenuto dei movimenti), spazi, note interne, registro delle operazioni. Azioni:
  - sospendere e riattivare (FinTrack lo disconnette subito e non lo fa più entrare);
  - chiudere tutte le sue sessioni;
  - mandargli il link di reset password, confermare l'email a mano;
  - azzerare la verifica in due passaggi (chiede il tuo codice);
  - regalare Pro per un periodo, o toglierlo;
  - disdire l'abbonamento Stripe (a fine periodo o subito) o annullare la disdetta;
  - eliminarlo (chiede la sua email e il tuo codice).
- **Abbonamenti** e **Pagamenti**: stati, rinnovi, disdette, omaggi; fatture e incassi da Stripe.
- **Sicurezza**: chi è bloccato per troppi tentativi (accessi, codici 2FA, reset), nuovi
  dispositivi, account sospesi, accessi al pannello rifiutati.
- **Registro**: ogni operazione del pannello, accessi compresi, con admin, utente, data e IP.
  Si conserva un anno.
- **Sistema**: configurazione, dimensione del database, righe per tabella, ultime migrazioni.

## Sicurezza

- Accesso con email, password (almeno 12 caratteri) e codice dell'app di autenticazione:
  il 2FA è obbligatorio. Dieci codici di recupero per quando non hai il telefono.
- Sessione di 8 ore in un cookie `httpOnly`, `SameSite=Strict`, firmato (HMAC-SHA256) e
  confrontato col database a ogni richiesta: cambiare password o «Esci dagli altri dispositivi»
  chiude subito tutte le altre sessioni.
- Tentativi limitati: 5 per email e 10 per IP ogni 15 minuti; risposta identica per email,
  password o codice sbagliati.
- Le azioni che non si annullano (eliminare un utente, azzerargli il 2FA) chiedono di nuovo il
  codice.
- `ADMIN_ALLOWED_IPS`: se lo imposti, gli altri IP ricevono un 404 e non vedono neanche la pagina
  di accesso.
- Header severi: Content-Security-Policy solo `self`, niente iframe, `noindex`, `no-store`.

## Mettere online il pannello (Vercel)

Serve un **secondo progetto Vercel** collegato allo stesso repository GitHub.

1. **Genera le due chiavi** sul tuo computer, nel terminale:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
   Eseguilo **due volte**: il primo valore è `ADMIN_SECRET`, il secondo `ADMIN_SETUP_TOKEN`.
   Tienili in un gestore di password.
2. Vai su [vercel.com/new](https://vercel.com/new) e scegli **Import** sul repository `fintrack`.
3. Nella schermata **Configure Project**:
   - **Project Name**: per esempio `fintrack-admin-<qualcosa-di-tuo>` (diventerà l'indirizzo,
     meglio se non facile da indovinare);
   - **Root Directory**: clicca **Edit**, scegli la cartella `admin` e conferma;
   - **Framework Preset**: Next.js (lo riconosce da solo).
4. Apri **Environment Variables** e aggiungi:
   - `DATABASE_URL` e `DIRECT_URL`: **gli stessi valori** del progetto FinTrack (li trovi in
     FinTrack › Settings › Environment Variables);
   - `ADMIN_SECRET`: il primo valore del punto 1;
   - `ADMIN_SETUP_TOKEN`: il secondo valore del punto 1;
   - `FINTRACK_URL`: `https://fintrack-six-iota.vercel.app`;
   - facoltative, gli stessi valori di FinTrack: `STRIPE_SECRET_KEY` (abbonamenti e pagamenti),
     `RESEND_API_KEY` ed `EMAIL_FROM` (email agli utenti).
5. Clicca **Deploy** e aspetta la fine (un paio di minuti).
6. Apri l'indirizzo del nuovo progetto e aggiungi `/setup` in fondo. Inserisci:
   `ADMIN_SETUP_TOKEN`, il tuo nome, la tua email e una password nuova (non quella di FinTrack).
7. Inquadra il codice QR con l'app di autenticazione (Google Authenticator, Microsoft
   Authenticator, 1Password, Bitwarden), scrivi il codice di 6 cifre e **salva i 10 codici di
   recupero**.
8. Entra da `/login`. Poi, su Vercel, **cancella `ADMIN_SETUP_TOKEN`** (Settings › Environment
   Variables) e rifai il deploy: la pagina di setup è già chiusa, ma così non resta niente.
9. Facoltativo: in **Settings › Deployment Protection** attiva **Vercel Authentication**, così
   per vedere il pannello serve anche essere entrati in Vercel. È una seconda porta davanti alla
   prima.

Se perdi telefono **e** codici di recupero: cancella la riga da `admin_users` nel database (dal
pannello di Neon), rimetti `ADMIN_SETUP_TOKEN` e rifai il setup.

## In locale

```bash
cp .env.example .env    # compila le variabili come sopra
npm install
npm run build && npm start   # http://localhost:3002
```

`npm test` esegue i test del pannello, `npm run typecheck` controlla i tipi.

## Schema del database

`prisma/schema.prisma` qui è una **copia** di quello di FinTrack: lo schema e le migrazioni sono
di FinTrack, il pannello non migra mai il database. Dopo ogni modifica allo schema, dalla cartella
principale:

```bash
node scripts/sync-admin-schema.mjs
```

Un test di FinTrack (`lib/admin-schema.test.ts`) fallisce finché la copia non è aggiornata.
