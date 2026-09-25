# FinTrack

Web app per la gestione delle finanze personali. Vedi [README.txt](./README.txt) per la descrizione completa del progetto, stack e funzionalità pianificate.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS v4
- shadcn/ui (componenti in `components/ui`)
- Prisma ORM + PostgreSQL
- ESLint + Prettier (con `prettier-plugin-tailwindcss`)

## Setup locale

```bash
npm install              # esegue anche prisma generate
cp .env.example .env     # compila DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET
npx prisma migrate dev   # crea/aggiorna le tabelle
npm run db:seed          # dati demo
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) e accedi con l'utente demo: `demo@fintrack.app` / `demo1234`.
Il seed è rieseguibile: cancella e ricrea solo l'utente demo.

Se la porta 3000 è occupata, Next.js parte sulla 3001: in quel caso avvia con
`NEXTAUTH_URL=http://localhost:3001 npx next dev -p 3001`, altrimenti i redirect di login puntano alla porta sbagliata.

## Variabili d'ambiente

| Variabile         | Dove                         | Descrizione                                                                                                            |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`    | locale + Vercel              | Connessione Neon **pooled** (host con `-pooler`), usata dall'app                                                       |
| `DIRECT_URL`      | locale + Vercel              | Connessione Neon **diretta** (host senza `-pooler`), per le migrazioni                                                 |
| `NEXTAUTH_SECRET` | locale + Vercel              | Chiave per firmare le sessioni; usa valori diversi in locale e produzione                                              |
| `NEXTAUTH_URL`    | locale + Vercel (Production) | URL pubblico dell'app, usato per redirect e link nelle email                                                           |
| `RESEND_API_KEY`  | opzionale                    | Invio email (reset password, riepilogo settimanale); senza, le email vengono stampate nei log                          |
| `EMAIL_FROM`      | opzionale                    | Mittente delle email, es. `FinTrack <onboarding@resend.dev>`                                                           |
| `CRON_SECRET`     | Vercel                       | Protegge `/api/cron/weekly-digest`; Vercel Cron lo invia come `Authorization: Bearer …`. Senza, il riepilogo non parte |

## Autenticazione

NextAuth v4 con provider email/password (bcrypt, 12 round) e sessioni JWT di 30 giorni.
Il middleware richiede il login su tutte le pagine tranne quelle di autenticazione (le nuove pagine sono protette di default); il reset password usa token monouso validi 1 ora, salvati solo come hash SHA-256.

## Funzionalità

- **Dashboard** (`/dashboard`): patrimonio netto, entrate/uscite/saldo del mese (confrontati con lo stesso periodo del mese precedente), trend entrate/uscite degli ultimi 6 mesi (con vista tabella) e spese del mese per categoria principale (max 6 fette, il resto in "Altro"). Numeri con animazione count-up; grafici con Recharts.
- **Budget** (`/budgets`): limite mensile per categoria di uscita (su una categoria principale include le sottocategorie), soglia di avviso personalizzabile (default 80%), stato "in linea / vicino al limite / superato" e spesa giornaliera consigliata fino a fine mese. Salvando una spesa che porta un budget oltre la soglia compare un avviso.
- **Obiettivi** (`/goals`): target, importo accumulato, data opzionale e contributo mensile suggerito; versamenti e prelievi (mai sotto zero, con UPDATE atomico).
- **Import CSV** (`/transactions/import`): il file viene letto nel browser (UTF-8 o Windows-1252, separatore rilevato, preambolo della banca saltato). Mappatura colonne proposta in automatico (importo con segno oppure dare/avere, 5 formati data) e ricordata per file con le stesse colonne. Anteprima, controllo dei possibili duplicati (stessa data, importo e tipo nel conto), categorie assegnate imparando dai movimenti con la stessa descrizione. Max 2000 righe per import.
- **Analisi** (`/insights`):
  - _Insight automatici_ in italiano, generati da regole di confronto (nessuna AI esterna): ritmo di spesa rispetto allo stesso periodo del mese precedente, categorie in forte aumento o calo (soglie: ±20% e almeno 20 €), tasso di risparmio del mese scorso, esercente più frequente, spesa nel weekend rispetto alla settimana (esclusi pagamenti ≥ 300 €), giorni senza spese. I primi 3 compaiono anche in dashboard.
  - _Flusso di cassa_ (Sankey) mensile: entrate → disponibile → categorie di spesa + risparmio; se le uscite superano le entrate compare "Prelevato dai risparmi". Di default mostra l'ultimo mese completo.
  - _Patrimonio netto nel tempo_: saldo complessivo giorno per giorno (3M / 6M / 1A / tutto), attività e passività.
  - _Calendario delle spese_: heatmap stile GitHub delle ultime 26 settimane, 4 tonalità per quartile; i giorni prima del primo movimento non entrano nelle statistiche.
- **Inserimento rapido** (dashboard e transazioni, tasto `/`): frasi come «35 benzina ieri», «caffè 1,50 contanti», «pizza 24 venerdì #amici», «stipendio 2350». Riconosce importo (anche `1.234,56`, `€35`, `+50`), date relative ed esplicite («ieri», «l'altro ieri», «3 giorni fa», «lunedì», «12/09», «5 agosto»), conto («contanti», «carta» o il nome), tag e categoria (descrizioni già usate, nomi delle categorie, dizionario di parole chiave). Anteprima dal vivo; «Modifica» apre il form completo precompilato. Parser in `lib/quick-entry/parse.ts`.
- **Abbonamenti e ricorrenti** (`/recurring`): rilevati in automatico da almeno 3 movimenti con la stessa descrizione normalizzata, cadenza regolare (settimanale → annuale) e importo stabile (le bollette sono ammesse come "importo variabile"). Mostra costo mensile/annuo, prossimi addebiti, aumenti di prezzo (che diventano anche un insight) e quelli forse disdetti.
- **Simulatore** (`/simulator`): proiezione con capitalizzazione mensile a partire dal patrimonio attuale; confronta "continuando così" con un risparmio extra e mostra quando raggiungeresti i tuoi obiettivi.
- **Piano debiti** (`/debts`): debiti con residuo, TAN e rata minima; simulazione mese per mese con strategia valanga (tasso più alto prima) e palla di neve (saldo più piccolo prima), data di estinzione, interessi totali, ordine di chiusura e grafico del residuo. Le rate dei debiti chiusi passano al successivo.
- **Onboarding guidato**: al primo accesso (nessun conto) la dashboard propone 3 passi: conto principale con saldo, categorie di partenza con sottocategorie (si tolgono con un tocco), primo movimento scritto a parole con l'inserimento rapido.
- **Traguardi** (`/achievements`): streak dei giorni in cui hai registrato qualcosa (calcolata sulla data di inserimento, fuso orario italiano; resta viva se ieri eri attivo), 9 badge con barra di avanzamento e 7 livelli a punti (movimenti, streak record, badge). In dashboard: streak e livello a colpo d'occhio, e un avviso quando sblocchi un badge. Logica pura in `lib/gamification/engine.ts`.
- **Report PDF** (`/reports`): mensile o annuale, generato sul server con `@react-pdf/renderer` (`/api/reports?period=month&month=AAAA-MM` o `?period=year&year=AAAA`): KPI con confronto sul periodo precedente, spese ed entrate per categoria, andamento mese per mese (annuale), budget (mensile), spese più grandi e saldi dei conti.
- **Riepilogo settimanale via email**: ogni lunedì alle 9 (07:00 UTC, `vercel.json`) Vercel Cron chiama `/api/cron/weekly-digest`, che invia a chi l'ha attivo il riepilogo della settimana precedente (lunedì–domenica): uscite ed entrate con confronto, categorie principali, budget a rischio, addebiti ricorrenti dei prossimi 7 giorni, streak e livello. Si attiva/disattiva in `/settings`, dove c'è anche l'anteprima; ogni email ha un link di disiscrizione firmato (HMAC con `NEXTAUTH_SECRET`) e l'header `List-Unsubscribe` one-click.
- **Impostazioni** (`/settings`, icona ingranaggio): nome e riepilogo settimanale.
- **Stati vuoti illustrati**: ogni pagina senza dati mostra un'illustrazione SVG (colori del tema, anche in dark mode) e l'azione per iniziare.
- **Tema chiaro/scuro** con transizione circolare (View Transitions API), che segue il sistema finché l'utente non sceglie. Animazioni disattivate con `prefers-reduced-motion`.
- **Conti** (`/accounts`): creazione, modifica, eliminazione; saldo calcolato in automatico.
- **Categorie** (`/categories`): categorie e sottocategorie di entrata/uscita con icona e colore.
- **Transazioni** (`/transactions`): entrate, uscite e trasferimenti con importo, data, conto, categoria, note e tag.
  Ricerca testuale (descrizione, note, tag) e filtri per tipo, conto, categoria (include le sottocategorie), date e importo; paginazione da 25.
  I filtri stanno nell'URL, quindi una ricerca si può salvare o condividere.

Gli importi si possono scrivere in formato italiano (`1.234,56`) o con il punto decimale (`1234.56`).

## Script disponibili

| Script                    | Descrizione                       |
| ------------------------- | --------------------------------- |
| `npm run dev`             | Avvia il server di sviluppo       |
| `npm run build`           | Build di produzione               |
| `npm run start`           | Avvia il build di produzione      |
| `npm run lint`            | Esegue ESLint                     |
| `npm test`                | Esegue i test (Vitest)            |
| `npm run format`          | Formatta il codice con Prettier   |
| `npm run format:check`    | Verifica la formattazione         |
| `npm run prisma:generate` | Genera il Prisma Client           |
| `npm run prisma:migrate`  | Applica le migrazioni in sviluppo |
| `npm run prisma:studio`   | Apre Prisma Studio                |
| `npm run db:seed`         | Ricrea l'utente demo con i dati   |

## Struttura cartelle

```
app/
  (auth)/         route group per login/registrazione
  (dashboard)/    route group per le pagine autenticate
  api/            API routes
components/
  ui/             componenti shadcn/ui
  layout/         header, sidebar, nav
  charts/         grafici (Recharts/Visx)
  forms/          form riutilizzabili
lib/
  db/             client Prisma
  validations/    schemi di validazione (zod)
  hooks/          hook React condivisi
  utils/          funzioni di utilità
prisma/
  schema.prisma   modello dati
  migrations/     migrazioni del database
types/            tipi TypeScript condivisi
```

## Database

PostgreSQL su [Neon](https://neon.tech) tramite Prisma. Schema in `prisma/schema.prisma`:

- `User`, `PasswordResetToken`
- `FinancialAccount`: i conti. Si chiama così perché NextAuth riserva il nome `Account` per l'OAuth. Il saldo non è salvato: è `initialBalance` + entrate − uscite − trasferimenti in uscita + trasferimenti in entrata (`lib/finance/balances.ts`).
- `Category`: gerarchia a due livelli (categoria/sottocategoria) tramite `parentId`; tipo INCOME o EXPENSE.
- `Transaction`: importi `Decimal(14,2)`, sempre positivi; il segno lo dà `type`:
  - `INCOME` / `EXPENSE`: movimento su `accountId`, con categoria opzionale dello stesso tipo
  - `TRANSFER`: sposta denaro da `accountId` a `transferAccountId`, senza categoria; non conta né come entrata né come uscita

Vincoli a livello di database (migrazione `transfers`): importo > 0, `transferAccountId` presente solo per i trasferimenti e diverso dal conto di origine.

Eliminare un conto elimina tutti i suoi movimenti, compresi i trasferimenti da e verso quel conto. Eliminare una categoria elimina le sue sottocategorie; i movimenti restano, senza categoria.

Dopo una modifica allo schema: `npx prisma migrate dev --name <descrizione>`.
Per applicare le migrazioni al database di produzione: `npx prisma migrate deploy`.

## Deploy

Il progetto è pensato per essere deployato su [Vercel](https://vercel.com). Collega il repository, imposta `DATABASE_URL` nelle Environment Variables del progetto Vercel e il deploy parte automaticamente ad ogni push.

Per il riepilogo settimanale servono anche `CRON_SECRET` (una stringa casuale lunga), `RESEND_API_KEY` ed `EMAIL_FROM`. Con il mittente di prova `onboarding@resend.dev` Resend consegna solo all'indirizzo del proprio account: per scrivere a qualunque utente serve un dominio verificato su Resend.
