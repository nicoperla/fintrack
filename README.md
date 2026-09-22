# FinTrack

Web app per la gestione delle finanze personali. Vedi [README.txt](./README.txt) per la descrizione completa del progetto, stack e funzionalità pianificate.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS v4
- shadcn/ui (componenti in `components/ui`)
- Prisma ORM + PostgreSQL
- ESLint + Prettier (con `prettier-plugin-tailwindcss`)

## Setup locale

```bash
npm install
cp .env.example .env   # imposta DATABASE_URL con un database Postgres (Supabase o Neon)
npx prisma generate
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Script disponibili

| Script                   | Descrizione                          |
| ------------------------ | ------------------------------------- |
| `npm run dev`             | Avvia il server di sviluppo           |
| `npm run build`           | Build di produzione                   |
| `npm run start`           | Avvia il build di produzione          |
| `npm run lint`            | Esegue ESLint                         |
| `npm run format`          | Formatta il codice con Prettier       |
| `npm run format:check`    | Verifica la formattazione             |
| `npm run prisma:generate` | Genera il Prisma Client               |
| `npm run prisma:migrate`  | Applica le migrazioni in sviluppo     |
| `npm run prisma:studio`   | Apre Prisma Studio                    |

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

Il progetto usa PostgreSQL tramite Prisma. Per lo sviluppo, crea un progetto gratuito su [Supabase](https://supabase.com) o [Neon](https://neon.tech), copia la connection string in `.env` come `DATABASE_URL`, poi esegui `npx prisma migrate dev`.

## Deploy

Il progetto è pensato per essere deployato su [Vercel](https://vercel.com). Collega il repository, imposta `DATABASE_URL` nelle Environment Variables del progetto Vercel e il deploy parte automaticamente ad ogni push.
