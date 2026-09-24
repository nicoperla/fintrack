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

| Variabile         | Dove                         | Descrizione                                                               |
| ----------------- | ---------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`    | locale + Vercel              | Connessione Neon **pooled** (host con `-pooler`), usata dall'app          |
| `DIRECT_URL`      | locale + Vercel              | Connessione Neon **diretta** (host senza `-pooler`), per le migrazioni    |
| `NEXTAUTH_SECRET` | locale + Vercel              | Chiave per firmare le sessioni; usa valori diversi in locale e produzione |
| `NEXTAUTH_URL`    | locale + Vercel (Production) | URL pubblico dell'app, usato per redirect e link nelle email              |
| `RESEND_API_KEY`  | opzionale                    | Invio email di reset password; senza, il link viene stampato nei log      |
| `EMAIL_FROM`      | opzionale                    | Mittente delle email, es. `FinTrack <onboarding@resend.dev>`              |

## Autenticazione

NextAuth v4 con provider email/password (bcrypt, 12 round) e sessioni JWT di 30 giorni.
Le route in `middleware.ts` richiedono il login; il reset password usa token monouso validi 1 ora, salvati solo come hash SHA-256.

## Script disponibili

| Script                    | Descrizione                       |
| ------------------------- | --------------------------------- |
| `npm run dev`             | Avvia il server di sviluppo       |
| `npm run build`           | Build di produzione               |
| `npm run start`           | Avvia il build di produzione      |
| `npm run lint`            | Esegue ESLint                     |
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
- `FinancialAccount`: i conti. Si chiama così perché NextAuth riserva il nome `Account` per l'OAuth. Il saldo non è salvato: è `initialBalance` + entrate − uscite.
- `Category`: gerarchia categoria/sottocategoria tramite `parentId`
- `Transaction`: importi `Decimal(14,2)`, sempre positivi; il segno lo dà `type` (INCOME/EXPENSE)

Dopo una modifica allo schema: `npx prisma migrate dev --name <descrizione>`.
Per applicare le migrazioni al database di produzione: `npx prisma migrate deploy`.

## Deploy

Il progetto è pensato per essere deployato su [Vercel](https://vercel.com). Collega il repository, imposta `DATABASE_URL` nelle Environment Variables del progetto Vercel e il deploy parte automaticamente ad ogni push.
