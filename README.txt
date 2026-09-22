Progetto: FinTrack — Web App per la gestione delle finanze personali
Obiettivo
Costruire una web app moderna per la gestione delle finanze personali, con login utente, database persistente e un'esperienza d'uso curata al punto da renderla piacevole da aprire ogni giorno (non l'ennesimo tracker noioso di spese). Deve unire solidità tecnica (dati corretti, sicuri, veloci) a un layer "delightful": animazioni fluide, insight intelligenti, gamification leggera.
Stack tecnologico
Frontend: Next.js 14+ (App Router) + TypeScript + Tailwind CSS
Componenti UI: shadcn/ui come base, personalizzata
Grafici: Recharts o Visx (serve qualcosa che regga Sankey, heatmap calendario, line chart animati)
Backend: API routes di Next.js (o tRPC se vuoi type-safety end-to-end)
Database: PostgreSQL + Prisma ORM
Auth: NextAuth.js (email/password + eventualmente Google OAuth)
Hosting suggerito: Vercel (frontend) + Supabase o Neon (Postgres)
State management: Zustand o React Query per i dati server
Funzionalità core (MVP)
Autenticazione: registrazione, login, logout, reset password, sessione persistente
Conti multipli: conto corrente, contanti, carte, risparmi — ognuno con saldo tracciato
Transazioni: entrate/uscite con importo, data, categoria, conto, note, tag
Categorie personalizzabili: gerarchia categoria/sottocategoria, icone e colori
Budget mensili per categoria: con barra di avanzamento e alert quando ci si avvicina al limite
Dashboard principale: saldo totale, entrate/uscite del mese, trend ultimi 6 mesi
Ricerca e filtri avanzati sulle transazioni (per data, categoria, conto, importo, testo)
Import CSV da estratti conto bancari (mapping colonne configurabile)
Funzionalità "wow" da aggiungere (differenzianti)
Cash flow Sankey diagram: visualizzazione a flusso di dove entra ed esce il denaro ogni mese
Heatmap calendario delle spese (stile GitHub contributions, ma per quanto spendi ogni giorno)
Net worth tracker: grafico del patrimonio netto nel tempo (somma conti + investimenti - debiti)
Rilevamento automatico abbonamenti ricorrenti: analizza le transazioni e segnala pattern ricorrenti (Netflix, palestra, ecc.), avvisando se il prezzo aumenta
Quick entry in linguaggio naturale: campo tipo "35 benzina ieri" che viene parsato automaticamente in importo/categoria/data
Simulatore "what-if": slider interattivi — "se risparmio 200€/mese, tra 3 anni avrò X" con proiezione a grafico
Piano di rientro dai debiti: metodo snowball/avalanche con timeline visiva
Obiettivi di risparmio (goals): card con progress bar, data target, contributo suggerito mensile
Insight automatici in linguaggio naturale: box mensile tipo "Hai speso il 23% in più in ristoranti rispetto al mese scorso" generato analizzando i dati (no AI esterna necessaria, basta logica di confronto periodi)
Gamification leggera: streak per i giorni consecutivi di tracking, badge per obiettivi raggiunti, "livello risparmiatore"
Budget condiviso/famiglia: possibilità di invitare un altro utente sullo stesso spazio (utile per coppie/famiglie)
Report PDF esportabile mensile/annuale
Multi-valuta con conversione automatica
Modalità scura/chiara con transizione animata, temi colore personalizzabili
PWA installabile (funziona offline per consultazione, si sincronizza alla riconnessione)
Digest settimanale via email con riepilogo spese
Modello dati (entità principali)
User: id, email, password_hash, name, created_at
Account: id, user_id, name, type (checking/cash/card/savings/investment), balance, currency
Transaction: id, account_id, category_id, amount, type (income/expense), date, description, tags[], notes
Category: id, user_id, name, parent_id (per sottocategorie), icon, color
Budget: id, user_id, category_id, amount, period (monthly), start_date
Goal: id, user_id, name, target_amount, current_amount, target_date, icon
RecurringTransaction: id, account_id, pattern_detected, frequency, avg_amount, next_expected_date
Household: id, name (per budget condivisi)
HouseholdMember: household_id, user_id, role
Requisiti UX/design
Design pulito, minimal, con largo uso di whitespace — ispirazione: Linear, Mercury, YNAB
Micro-animazioni su transizioni, numeri che si animano al caricamento (count-up)
Mobile-first, deve essere perfettamente usabile da telefono
Onboarding guidato al primo accesso (max 3 step per iniziare a usarla)
Empty states curati (non pagine vuote grigie, ma illustrazioni + CTA chiare)
Requisiti non funzionali
Password hashate (bcrypt/argon2), validazione input lato server
Rate limiting su login/API sensibili
HTTPS, variabili d'ambiente per secrets, mai committare credenziali
Query database ottimizzate con indici su user_id, date, category_id
Test almeno sulle funzioni critiche (calcolo saldi, budget, ricorrenze) 