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

Apri [http://localhost:3000](http://localhost:3000) e accedi con l'utente demo: `demo@fintrack.app` / `demo1234`. Lo spazio demo «Casa Demo» è condiviso con `sara@fintrack.app` (stessa password) e ha un conto in dollari.
Il seed è rieseguibile: cancella e ricrea solo l'utente demo.

Se la porta 3000 è occupata, Next.js parte sulla 3001: in quel caso avvia con
`NEXTAUTH_URL=http://localhost:3001 npx next dev -p 3001`, altrimenti i redirect di login puntano alla porta sbagliata.

## Variabili d'ambiente

| Variabile                 | Dove                         | Descrizione                                                                                                                             |
| ------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | locale + Vercel              | Connessione Neon **pooled** (host con `-pooler`), usata dall'app                                                                        |
| `DIRECT_URL`              | locale + Vercel              | Connessione Neon **diretta** (host senza `-pooler`), per le migrazioni                                                                  |
| `NEXTAUTH_SECRET`         | locale + Vercel              | Chiave per firmare le sessioni; usa valori diversi in locale e produzione                                                               |
| `NEXTAUTH_URL`            | locale + Vercel (Production) | URL pubblico dell'app, usato per redirect e link nelle email                                                                            |
| `RESEND_API_KEY`          | opzionale                    | Invio email (reset password, riepilogo settimanale); senza, le email vengono stampate nei log                                           |
| `EMAIL_FROM`              | opzionale                    | Mittente delle email, es. `FinTrack <onboarding@resend.dev>`                                                                            |
| `CRON_SECRET`             | Vercel                       | Protegge `/api/cron/weekly-digest`; Vercel Cron lo invia come `Authorization: Bearer …`. Senza, il riepilogo non parte                  |
| `GROQ_API_KEY`            | opzionale                    | Coach AI gratuito (piano free di Groq, senza carta, con limiti al minuto)                                                               |
| `ANTHROPIC_API_KEY`       | opzionale                    | Coach AI con Claude (a pagamento, ha la precedenza su Groq); senza nessuna delle due, la chat usa le risposte rapide calcolate dall'app |
| `COACH_MODEL`             | opzionale                    | Modello del coach (predefinito `claude-opus-5-5` con Anthropic, `openai/gpt-oss-120b` con Groq)                                         |
| `COACH_DAILY_LIMIT`       | opzionale                    | Domande al coach AI per persona al giorno (predefinito 30)                                                                              |
| `COACH_GLOBAL_PER_MINUTE` | opzionale                    | Domande al minuto per tutta l'app; senza, 2 con Groq gratuito e nessun limite con Anthropic                                             |
| `STRIPE_SECRET_KEY`       | per i pagamenti              | Chiave segreta Stripe (`sk_test_…` in prova, `sk_live_…` in produzione)                                                                 |
| `STRIPE_PRICE_ID`         | per i pagamenti              | Prezzo ricorrente di FinTrack Pro (`price_…`); con questa e la chiave segreta i pagamenti si attivano                                   |
| `STRIPE_WEBHOOK_SECRET`   | per i pagamenti              | Segreto dell'endpoint webhook `/api/billing/webhook` (`whsec_…`)                                                                        |
| `LEGAL_OWNER`             | prima del lancio             | Titolare mostrato in privacy e termini (nome, o ragione sociale e P.IVA)                                                                |
| `LEGAL_EMAIL`             | prima del lancio             | Email di contatto per privacy, recesso e richieste                                                                                      |

## Autenticazione

NextAuth v4 con provider email/password (bcrypt, 12 round) e sessioni JWT di 30 giorni.
Il middleware richiede il login su tutte le pagine tranne landing, autenticazione, privacy, termini e link via email (le nuove pagine sono protette di default); il reset password usa token monouso validi 1 ora, salvati solo come hash SHA-256.

- **Conferma dell'email**: alla registrazione parte un link valido 48 ore (`/verify-email`, token salvato come hash). L'account funziona subito; finché l'email non è confermata un banner lo ricorda (con «Rinvia il link») e restano bloccati inviti e coach AI. Gli account esistenti prima di questa funzione sono considerati confermati.
- **Rate limiting** (`lib/rate-limit.ts`): contatori a finestra fissa nella tabella `rate_limits`, con un upsert atomico (funziona con più istanze serverless). Accesso: 8 tentativi per email e 30 per IP ogni 15 minuti; registrazione: 5 per IP all'ora; reset password: 3 per email (in silenzio, per non rivelare quali email esistono) e 10 per IP all'ora; inviti: 20 al giorno; coach AI: 5 al minuto e 30 al giorno per persona, più un limite globale per Groq gratuito. Una domanda a cui l'AI non risponde non consuma la quota.
- **Pulizia notturna** (`/api/cron/cleanup`, 02:30 UTC): cancella contatori, link e inviti scaduti, così email e IP dei tentativi restano al massimo 2 giorni.

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
- **Dettatura**: il microfono nell'inserimento rapido usa il riconoscimento vocale del browser in italiano (Chrome, Android, Safari su iOS; il pulsante non compare dove non è supportato). La frase passa allo stesso parser, che ignora le parole tipiche del parlato («ho speso», «ho pagato») e capisce «12 euro e 50».
- **Il prezzo in ore di lavoro**: le spese mostrano anche quanto tempo di lavoro valgono (inserimento rapido, modulo del movimento, uscite del mese in dashboard). La tariffa oraria viene dalle entrate nette mensili e dalle ore settimanali impostate in `/settings`; senza entrate impostate usa la media delle entrate registrate dall'utente negli ultimi 3 mesi completi. Logica in `lib/finance/work-time.ts`.
- **I prossimi 45 giorni** (dashboard): proiezione del saldo dei conti di tutti i giorni (corrente, carte, contanti): saldo di oggi, entrate e uscite ricorrenti nei loro giorni e spesa abituale media (ultimi 60 giorni, esclusi i ricorrenti). Avvisa se il saldo andrà sotto zero o sotto una settimana di spese. Logica in `lib/finance/forecast.ts`.
- **Soldi ritrovati** (`/ritrovati`, e il contatore in dashboard): i soldi che l'utente può recuperare, trovati nei suoi movimenti.
  - **Il 730 che si scrive da solo** (`lib/finance/deductions.ts`): riconosce le spese detraibili al 19% da categoria e descrizione (sanitarie con franchigia di 129,11 €, veterinarie fino a 550 €, scuola fino a 800 € e sport dei figli fino a 210 € per figlio, asilo nido 632 €, abbonamenti ai mezzi 250 €, assicurazioni vita e infortuni 530 €, interessi del mutuo 4.000 €) e stima il rimborso IRPEF per persona (ognuno ha la sua franchigia; le spese vanno a chi le ha registrate). Le spese pagate in contanti che devono essere tracciabili non contano, tranne farmaci, dispositivi medici e ticket; quelle incerte (rata del mutuo, polizze, «Salute» generico) restano da confermare. Ogni scelta manuale è salvata in `transactions.deduction`. Le regole valgono per le spese dal 2025 e vanno aggiornate a ogni legge di bilancio (`RULES`, `RULES_CHECKED_AT`).
  - **Avviso in tempo reale**: salvando una spesa detraibile pagata in contanti compare «Con carta o bancomat avresti recuperato circa X €».
  - **Dossier 730** (`/api/ritrovati/dossier?anno=AAAA&chi=io|tutti`): PDF con le spese per tipo, lo stato di ognuna, i totali, il rimborso stimato e i documenti da conservare.
  - **Altri ritrovamenti** (`lib/finance/found-money.ts`): possibili doppi addebiti (stesso importo, esercente e conto entro un giorno, da 15 € in su, ultimi 90 giorni), abbonamenti aumentati (costo in più all'anno), rinnovi annuali o trimestrali entro 30 giorni, commissioni bancarie annualizzate. Da ognuno parte una pratica di Riprenditeli. «Non è un errore» / «Lo tengo» salvano la scelta in `found_money_dismissals`.
  - **Riprenditeli** (`/ritrovati/pratiche`): dai soldi trovati a quelli riavuti. Una pratica (tabella `claims`) per ogni disdetta, rimborso di un addebito diretto SEPA, reclamo alla banca o addebito doppio; parte da un ritrovamento, da un movimento («Contesta questo addebito» nel modulo del movimento) o da zero. La lettera è pronta con le norme giuste (`lib/claims/letters.ts`: artt. 13–14 del d.lgs. 11/2010 per il rimborso SDD entro 8 settimane, artt. 9 e 11 per gli addebiti non autorizzati, art. 118 TUB per le commissioni) e si copia, si apre nell'email o si scarica in PDF per la raccomandata (Pro, `/api/ritrovati/pratiche/<id>/pdf`). IBAN e numero cliente restano tra parentesi quadre: si completano nell'email e non vengono mai salvati. FinTrack non invia niente: l'utente segna come e quando ha inviato e l'app calcola la scadenza della risposta (`lib/finance/claims.ts`: 10 giornate operative per il rimborso, 15 per i reclami sui pagamenti, 60 giorni per gli altri, 14 giorni per il negozio; festività italiane comprese), indica il prossimo passo, fino all'Arbitro Bancario Finanziario, e dopo una disdetta segnala gli addebiti arrivati comunque, da cui si apre il rimborso con un tocco. Esiti e importi recuperati finiscono nella card della dashboard e nel riepilogo settimanale. Il piano gratuito segue una pratica aperta alla volta.
  - Con i pagamenti attivi, il piano gratuito vede i totali; i dettagli (quali spese, dossier) sono di Pro e non vengono nemmeno inviati alla pagina.
- **Coach** (`/coach`): un check-up di tutti i dati dello spazio giudicato con le regole scelte dall'utente. Il profilo («Il tuo stile», salvato in `users.coach_profile`) contiene il metodo (50/30/20, prima paga te stesso, un budget per ogni cosa, libertà finanziaria, vivere sereno), la quota di risparmio, i mesi di cuscinetto, le priorità, le categorie da non toccare mai, il tono (gentile, diretto, da allenatore) e una frase libera. Il motore deterministico (`lib/finance/coach.ts`) calcola un punteggio di salute 0–100 su quattro pilastri (risparmio, cuscinetto, controllo, debiti), il piano del metodo scelto, fino a 8 consigli concreti ordinati per urgenza (rosso in vista, obiettivo di risparmio, budget sforati, abbonamenti, debito più caro, tabacchi e giochi in tempo di lavoro, categorie in crescita, piccole spese, obiettivi a rischio…), i tagli possibili solo tra i desideri non protetti e una sfida della settimana. In dashboard compare il punteggio con il consiglio più urgente.
  - **Chiedi al coach**: con `ANTHROPIC_API_KEY` la chat usa Claude, con `GROQ_API_KEY` un modello gratuito su Groq (`lib/coach/providers.ts`; `/api/coach/chat`, risposta in streaming). A Groq, per stare nei limiti del piano gratuito, vanno solo gli ultimi 30 giorni di movimenti (max 50). Il modello riceve profilo, medie, categorie mese per mese, conti, previsione, ricorrenti, budget, obiettivi, debiti, i consigli calcolati e gli ultimi 90 giorni di movimenti (max 300), costruiti in `lib/coach/context.ts`; le istruzioni gli vietano di consigliare prodotti d'investimento. Senza chiave (o se l'API non risponde) la chat usa le risposte rapide di `lib/finance/coach-answers.ts`.
  - **Posso permettermelo?**: si scrive l'acquisto a parole («bici 890», «palestra 45 al mese») e il verdetto arriva mentre si scrive, calcolato nel browser (`lib/finance/affordability.ts`): saldo previsto con e senza l'acquisto (margine di sicurezza: una settimana di spese), giorno migliore per comprarlo (es. dopo lo stipendio), ritardo sugli obiettivi, effetto sul budget della categoria riconosciuta e ore di lavoro.
- **Conti chiari** (`/split`, spazi con più persone): chi ha pagato le spese comuni (chi le ha registrate) e quanto spetta a ciascuno, a metà o in proporzione alle entrate (stipendio impostato in `/settings` o media delle entrate registrate), da una data scelta. Le spese con il tag «personale» restano fuori (si segnano con un tocco dall'elenco). Indica i trasferimenti minimi per pareggiare; «Segna come saldato» registra il pareggio (tabella `settlements`). Logica in `lib/finance/split.ts`.
- **Il mese in storie** (`/stories?month=AAAA-MM`): il mese raccontato a slide a schermo intero, come le storie di Instagram (avanzano da sole; tocco a destra/sinistra, tieni premuto per fermare, frecce, spazio ed Esc da tastiera): entrate e uscite, risparmio, categoria protagonista in ore di lavoro, top 5, spesa più grande, posto più frequentato, giorno più caro, giorni senza spese, confronto col mese prima e un profilo del mese («Il Buongustaio», «L'Esploratore», «Il Risparmiatore Zen»…). L'ultima slide genera nel browser un'immagine da condividere senza importi. In dashboard, la bolla del mese appena finito. Logica in `lib/finance/stories.ts`.
- **Modalità discreta**: l'icona a forma di occhio nell'intestazione nasconde saldi e importi in tutta l'app (grafici, insight e avvisi compresi); la scelta è ricordata in un cookie, così la pagina arriva già mascherata dal server.
- **Abbonamenti e ricorrenti** (`/recurring`): rilevati in automatico da almeno 3 movimenti con la stessa descrizione normalizzata, cadenza regolare (settimanale → annuale) e importo stabile (le bollette sono ammesse come "importo variabile"). Mostra costo mensile/annuo, prossimi addebiti, aumenti di prezzo (che diventano anche un insight) e quelli forse disdetti.
- **Simulatore** (`/simulator`): proiezione con capitalizzazione mensile a partire dal patrimonio attuale; confronta "continuando così" con un risparmio extra e mostra quando raggiungeresti i tuoi obiettivi.
- **Piano debiti** (`/debts`): debiti con residuo, TAN e rata minima; simulazione mese per mese con strategia valanga (tasso più alto prima) e palla di neve (saldo più piccolo prima), data di estinzione, interessi totali, ordine di chiusura e grafico del residuo. Le rate dei debiti chiusi passano al successivo.
- **Onboarding guidato**: al primo accesso (nessun conto) la dashboard propone 3 passi: conto principale con saldo, categorie di partenza con sottocategorie (si tolgono con un tocco), primo movimento scritto a parole con l'inserimento rapido.
- **Traguardi** (`/achievements`): streak dei giorni in cui hai registrato qualcosa (calcolata sulla data di inserimento, fuso orario italiano; resta viva se ieri eri attivo), 9 badge con barra di avanzamento e 7 livelli a punti (movimenti, streak record, badge). In dashboard: streak e livello a colpo d'occhio, e un avviso quando sblocchi un badge. Logica pura in `lib/gamification/engine.ts`.
- **Report PDF** (`/reports`): mensile o annuale, generato sul server con `@react-pdf/renderer` (`/api/reports?period=month&month=AAAA-MM` o `?period=year&year=AAAA`): KPI con confronto sul periodo precedente, spese ed entrate per categoria, andamento mese per mese (annuale), budget (mensile), spese più grandi e saldi dei conti.
- **Riepilogo settimanale via email**: ogni lunedì alle 9 (07:00 UTC, `vercel.json`) Vercel Cron chiama `/api/cron/weekly-digest`, che invia a chi l'ha attivo il riepilogo della settimana precedente (lunedì–domenica): uscite ed entrate con confronto, categorie principali, budget a rischio, pratiche di Riprenditeli da fare subito o in scadenza entro 14 giorni, addebiti ricorrenti dei prossimi 7 giorni, streak e livello. Si attiva/disattiva in `/settings`, dove c'è anche l'anteprima; ogni email ha un link di disiscrizione firmato (HMAC con `NEXTAUTH_SECRET`) e l'header `List-Unsubscribe` one-click.
- **Impostazioni** (`/settings`, icona ingranaggio): nome, spazio condiviso, riepilogo settimanale, abbonamento e privacy.
- **Privacy (GDPR)**: pagine pubbliche `/privacy` e `/terms` (titolare da `LEGAL_OWNER`/`LEGAL_EMAIL`); accettazione di termini e privacy alla registrazione (`users.terms_accepted_at`); consenso esplicito prima del coach AI, revocabile dalle impostazioni (`users.ai_consent_at`; senza consenso il server rifiuta); «Scarica i tuoi dati» (`/api/account/export`: JSON con profilo e tutti gli spazi, gli altri membri solo per nome); «Elimina account» con password e conferma scritta: disdice l'abbonamento Stripe, passa gli spazi condivisi a chi ne fa parte da più tempo e cancella il resto, comprese le pratiche di Riprenditeli aperte negli spazi condivisi (le lettere sono a suo nome).
- **FinTrack Pro** (Stripe): il piano gratuito ha tutto tranne la chat del coach AI. Pro aggiunge anche i dettagli di Soldi ritrovati, le pratiche di Riprenditeli senza limite e le lettere in PDF. «Passa a Pro» apre Stripe Checkout (abbonamento con `STRIPE_PRICE_ID`, codici sconto ammessi), «Gestisci abbonamento» il Customer Portal (carta, fatture, disdetta). Il webhook `/api/billing/webhook` (eventi `checkout.session.completed` e `customer.subscription.*`, firma verificata) aggiorna `users.plan`; `past_due` mantiene Pro durante i tentativi di addebito. Senza variabili Stripe i pagamenti sono spenti e il coach AI resta aperto a tutti, con i limiti per persona.
- **Landing page** (`/`): per chi non ha fatto l'accesso, presentazione delle funzioni, prezzi (il prezzo di Pro viene letto da Stripe), privacy e domande frequenti; chi ha già fatto l'accesso va alla dashboard.
- **Spazi condivisi (coppia/famiglia)**: ogni utente ha uno spazio personale e può invitare altre persone (fino a 10) da `/settings`. Chi entra vede e modifica gli stessi conti, movimenti, budget, obiettivi e debiti; accanto a ogni movimento compare chi l'ha registrato. L'invito è un link monouso valido 7 giorni e legato all'email invitata (salvato solo come hash SHA-256), inviato via email e copiabile. Chi è invitato può uscire, il proprietario può rimuovere persone; i movimenti registrati restano nello spazio. Con più spazi, il selettore in alto permette di passare dall'uno all'altro. Streak e badge di costanza restano personali; quelli su budget e obiettivi sono dello spazio.
- **Multi-valuta**: ogni conto ha la sua valuta (30 valute con cambio BCE) e lo spazio una valuta principale. Ogni movimento salva l'importo nella valuta del conto e il controvalore nella valuta principale al cambio BCE del suo giorno (`base_amount`): totali, budget, grafici, report e insight sommano quello. Saldi e patrimonio convertono al cambio di oggi. Nei trasferimenti tra valute si può indicare l'importo effettivamente ricevuto (commissioni comprese), altrimenti lo calcola il cambio del giorno. I tassi vengono da [Frankfurter](https://frankfurter.dev) (gratuito, senza chiave) e sono salvati nella tabella `exchange_rates`: l'API viene chiamata solo per giorni mancanti e solo se c'è una valuta diversa dall'euro. Cambiando la valuta principale, i movimenti vengono ricalcolati al cambio del loro giorno e budget/obiettivi/debiti al cambio di oggi.
- **PWA installabile e offline**: manifest, icone generate (`/icons/*`) e service worker (`public/sw.js`, attivo solo nella build di produzione). Le pagine già visitate restano consultabili offline (rete prima, poi copia salvata; `/offline.html` per le altre). I movimenti registrati offline (inserimento rapido o modulo) restano in una coda sul dispositivo, legata a utente e spazio, e vengono inviati al ritorno della connessione; un banner mostra lo stato. All'uscita le pagine salvate vengono cancellate.
- **Stati vuoti illustrati**: ogni pagina senza dati mostra un'illustrazione SVG (colori del tema, anche in dark mode) e l'azione per iniziare.
- **Tema chiaro/scuro** con transizione circolare (View Transitions API), che segue il sistema finché l'utente non sceglie. Animazioni disattivate con `prefers-reduced-motion`.
- **Conti** (`/accounts`): creazione, modifica, eliminazione; saldo calcolato in automatico.
- **Categorie** (`/categories`): categorie e sottocategorie di entrata/uscita con icona e colore. Il set di partenza (`lib/defaults/categories.ts`) comprende tra le altre Tabacchi (sigarette, svapo e IQOS, lotto e gratta e vinci), Cura personale, Viaggi, Famiglia e figli, Animali, Istruzione, Assicurazioni, Tasse e commissioni; agli spazi esistenti la pagina propone le categorie e sottocategorie che mancano, senza duplicare quelle con lo stesso nome.
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
- `Household` (spazio): nome, valuta principale e proprietario; `HouseholdMember` (ruolo OWNER/MEMBER) e `HouseholdInvite`. Tutti i dati finanziari hanno `householdId`; `userId` indica solo chi li ha creati. Lo spazio personale di un utente ha lo stesso id dell'utente.
- `ExchangeRate`: tassi BCE giornalieri (unità di valuta per 1 €).
- `FinancialAccount`: i conti. Si chiama così perché NextAuth riserva il nome `Account` per l'OAuth. Il saldo non è salvato: è `initialBalance` + entrate − uscite − trasferimenti in uscita + trasferimenti in entrata (`lib/finance/balances.ts`).
- `Category`: gerarchia a due livelli (categoria/sottocategoria) tramite `parentId`; tipo INCOME o EXPENSE.
- `Transaction`: importi `Decimal(14,2)`, sempre positivi, nella valuta del conto (`amount`) e nella valuta dello spazio (`baseAmount`); il segno lo dà `type`:
  - `INCOME` / `EXPENSE`: movimento su `accountId`, con categoria opzionale dello stesso tipo
  - `TRANSFER`: sposta denaro da `accountId` a `transferAccountId`, senza categoria; non conta né come entrata né come uscita
- `Claim` (pratiche di Riprenditeli): tipo, stato (`DRAFT` → `SENT` → `WON`/`PARTIAL`/`LOST`/`DROPPED`), controparte, importo atteso e recuperato, oggetto e testo della lettera, canale, data di invio, decorrenza della disdetta e scadenza della risposta. `findingKey` (unico per spazio) la lega al ritrovamento da cui è nata, `transactionId` al movimento contestato.

Vincoli a livello di database (migrazione `transfers`): importo > 0, `transferAccountId` presente solo per i trasferimenti e diverso dal conto di origine.

Eliminare un conto elimina tutti i suoi movimenti, compresi i trasferimenti da e verso quel conto. Eliminare una categoria elimina le sue sottocategorie; i movimenti restano, senza categoria.

Dopo una modifica allo schema: `npx prisma migrate dev --name <descrizione>`.
Per applicare le migrazioni al database di produzione: `npx prisma migrate deploy`.

## Deploy

Il progetto è pensato per essere deployato su [Vercel](https://vercel.com). Collega il repository, imposta `DATABASE_URL` nelle Environment Variables del progetto Vercel e il deploy parte automaticamente ad ogni push.

Per il riepilogo settimanale servono anche `CRON_SECRET` (una stringa casuale lunga), `RESEND_API_KEY` ed `EMAIL_FROM`. Con il mittente di prova `onboarding@resend.dev` Resend consegna solo all'indirizzo del proprio account: per scrivere a qualunque utente serve un dominio verificato su Resend.
