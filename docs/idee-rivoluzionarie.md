# FinTrack: idee rivoluzionarie

_Ricerca e strategia, 6 ottobre 2026. In questa fase nessun file di codice è stato toccato: questo documento è l'unico file creato._

## In breve

- **9 idee** sopravvissute al filtro, su 7 categorie; 2 sono "folli ma possibili" (il fascicolo di famiglia e il patto). Altre 8 le ho scartate io, con il motivo, in fondo alla sezione 3.
- **Le 3 da fare per prime:**
  1. **Riprenditeli**: FinTrack non si limita più a *trovare* i soldi persi, li va a *riprendere*: pratica, lettera, scadenze di legge, esito.
  2. **Lo stipendio vero**: un numero solo, quanto puoi spendere oggi con le stangate dell'anno già messe da parte. Da lanciare prima della tredicesima.
  3. **Radar dei diritti**: il 730 precompilato confrontato con le spese che FinTrack ha visto passare, più detrazioni, bonus e welfare. Pronto per fine aprile 2027.
- **Il filo comune:** gli altri ti *mostrano* i soldi; FinTrack li *recupera* usando regole italiane che nessun concorrente straniero modella.
- **Il limite da tenere d'occhio:** senza una connessione bancaria automatica, tutto ciò che si basa sul riconoscimento automatico rende meno. Ne parlo nella sezione 4.

---

## 1. Cosa esiste già

### Le funzioni in 10 righe

1. **Base:** conti multipli e multi-valuta (cambi BCE), movimenti con categorie su due livelli e tag, trasferimenti, spazi condivisi fino a 10 persone, PWA che funziona offline.
2. **Inserimento:** frasi in linguaggio naturale («35 benzina ieri»), dettatura vocale, import CSV degli estratti conto con mappatura ricordata e controllo dei duplicati. **Nessuna connessione bancaria automatica.**
3. **Pianificazione:** budget per categoria, obiettivi, piano debiti (valanga o palla di neve), simulatore, previsione del saldo a 45 giorni, «Posso permettermelo?».
4. **Analisi:** insight a regole, Sankey, patrimonio nel tempo, heatmap, abbonamenti e ricorrenti con gli aumenti di prezzo, investimenti con versato e valore (in sviluppo, non ancora committati).
5. **Coach:** punteggio di salute 0–100 su quattro pilastri, giudicato col metodo scelto dall'utente; chat AI (Claude o Groq) che riceve i numeri già calcolati e non può consigliare prodotti.
6. **Soldi ritrovati:** il 730 che si scrive da solo (8 tipi di detrazione, dossier PDF), doppi addebiti, abbonamenti aumentati, rinnovi in arrivo, commissioni bancarie, lettere di disdetta.
7. **Coppia:** Conti chiari, con le spese comuni divise a metà o in proporzione al reddito e i pareggi minimi.
8. **Comportamento:** il prezzo in ore di lavoro, il mese raccontato in storie con archetipi condivisibili, streak, badge, livelli, digest del lunedì, report PDF, modalità discreta.
9. **Business:** FinTrack Pro su Stripe (chat AI e dettagli di Soldi ritrovati), landing, GDPR completo (export, cancellazione, consenso all'AI), rate limiting.
10. **Dati a disposizione:** ogni movimento con descrizione bancaria, autore, conto e categoria; ricorrenti con prezzo e prossima data; reddito netto, ore di lavoro, figli a carico, metodo e priorità; budget, obiettivi, debiti con TAN, valori degli investimenti, scelte sulle detrazioni. **Mancano:** banca collegata, provincia, documenti (bollette, contratti, KID), reddito lordo.

### Perché questi dati sono un vantaggio

Le app delle banche vedono solo i propri conti. I comparatori non vedono niente. Gli assistenti AI generici non conoscono la tua storia. FinTrack ha tre cose insieme: **lo storico** (si accorge che un addebito arriva *dopo* una disdetta), **la famiglia** (chi paga cosa, quanti figli) e **le regole italiane** già scritte in codice (`lib/finance/deductions.ts`). Le idee migliori qui sotto usano tutte e tre.

---

## 2. Il settore

### Cosa fanno i concorrenti e dove si fermano

| App | Cosa fa bene | Dove si ferma, per un italiano |
| --- | --- | --- |
| **Satispay** | 6,5 milioni di utenti; dal 2026 ha IBAN, carte Mastercard, investimenti in azioni/ETF e fondi | Vede solo i soldi che passano da Satispay; gestione del budget minima |
| **Revolut** | Budget, salvadanai, abbonamenti; l'assistente AI **AIR** è in Europa da settembre 2026 | Vede solo Revolut; AIR per scelta non esegue bonifici e non dà consigli; niente fisco italiano |
| **N26** | Spaces, statistiche | Solo il conto N26 |
| **Fineco e app bancarie** | PFM integrato | Solo i propri conti; nessun interesse a mostrarti il costo dei loro prodotti |
| **Moneyfarm** | Investimenti gestiti, previdenza | Non segue la spesa quotidiana |
| **YNAB** | Metodo a budget zero, community | 109 $/anno, tutto manuale, pensata per gli USA, niente AI |
| **Emma** (UK) | Open banking, abbonamenti, tracker delle commissioni | Copertura delle banche incompleta; 3,5/5 su Trustpilot; nessuna regola fiscale italiana |
| **Copilot, Monarch** | Interfaccia eccellente, gestione della famiglia, categorie con AI | Solo USA (Plaid), circa 100 $/anno |
| **Spendee, Wallet by BudgetBakers** | Multi-paese, sincronizzazione via aggregatori | Sincronizzazione instabile, categorie generiche, zero burocrazia italiana |
| **Rocket Money** (USA) | Disdice abbonamenti e **negozia le bollette** con persone vere | Trattiene il 35–60% del risparmio del primo anno; in Italia non esiste |

### Le lamentele che tornano sempre

1. **La sincronizzazione con la banca si rompe.** È la prima fonte di recensioni negative per tutte le app che dipendono da Plaid, Tink e simili.
2. **Prezzo contro valore percepito.** I thread "alternative a YNAB" esplodono a ogni rincaro; Monarch è considerata la migliore, ma pagarla brucia.
3. **Categorizzare a mano** è un lavoro che non finisce mai.
4. **Pensate per una persona sola**: le coppie sono gestite male o per niente.
5. _(sintesi nostra)_ **Ti mostrano, ma non fanno**: gli insight non diventano mai un'azione.
6. _(sintesi nostra)_ **Prodotti generici**: nessuna conosce tredicesima, IMU, 730, ISEE, bonus.

### Novità normative e tecnologiche

| Cosa | Quando | Cosa significa per FinTrack |
| --- | --- | --- |
| **PSD3 e PSR** (open banking) | Accordo provvisorio il 27/11/2025; pubblicazione nel 2026; applicazione tra fine 2027 e il 2028 | API bancarie più affidabili e una dashboard dei permessi per l'utente: è il momento di pianificare la connessione bancaria tramite un partner |
| **FIDA** (open finance: pensioni, polizze, investimenti) | Ferma: a settembre 2026 nessun trilogo in programma | Per anni i dati di polizze, fondi e previdenza non arriveranno via API: documenti e inserimento guidato restano la strada |
| **Euro digitale** | Voto del Parlamento UE a luglio 2026; pilota nel 2027; prima emissione nel 2029 | Nessuna azione ora |
| **Pagamenti con agenti AI** | Mastercard Agent Pay operativo in Europa (primo pagamento con Santander, marzo 2026); Visa Agentic Ready | Gli agenti che pagano arriveranno, ma servono licenze o partner: oggi l'AI prepara e l'utente conferma |
| **AI Act, art. 50** | Dal 2 agosto 2026 | Coach e testi generati devono dichiarare chiaramente che sono AI |
| **Pulsante di recesso** (d.lgs. 209/2025, art. 54-bis Codice del consumo) | Dal 19 giugno 2026 | Disdire un contratto online deve essere facile come firmarlo: un appiglio concreto per *Riprenditeli* |
| **Rimborso dei pedaggi** per cantieri e code (delibera ART 211/2025) | Dal 1° giugno 2026; tratte con più concessionari dal 1° dicembre 2026 | Nuovi soldi da ritrovare |
| **Cambio del fornitore di luce in 24 ore** | Previsto dal 1° dicembre 2026 | Cambiare costa meno fatica: il Tariffometro diventa azionabile |
| **Legge di bilancio 2026** | In vigore | IRPEF del 2° scaglione al 33%, riforma ISEE, bonus elettrodomestici (ISEE sotto 25.000 €), fringe benefit fino a 1.000 €, o 2.000 € con figli: regole per il Radar dei diritti |
| **TFR in silenzio-assenso** per i neoassunti | Dal 1° luglio 2026, 60 giorni per scegliere | Un momento di scelta da spiegare, senza consigliare |
| **Cripto** | Aliquota al 33% dal 2026; DAC8 in vigore | Nicchia; gli exchange italiani iniziano a pagare le imposte per conto del cliente |
| **IT-Wallet in App IO** | Nuovi documenti tra settembre e ottobre 2026, ISEE compreso | Più avanti, attestazioni verificabili da importare |
| **Open banking per sviluppatori** | GoCardless Bank Account Data (ex Nordigen) non accetta nuove iscrizioni | Gli aggregatori con copertura italiana sono 34, ma a pagamento: la connessione bancaria ha un costo per utente e va ripagata da Pro |

### I 5 buchi del mercato

1. **Dal "ti mostro" al "lo faccio io".** Tutti trovano abbonamenti e commissioni; nessuno, in Italia, fa il passo burocratico per riavere i soldi (PEC, reclamo, 8 settimane per i RID, Arbitro Bancario Finanziario).
2. **Il calendario italiano dei soldi non esiste nelle app.** Tredicesima, quattordicesima, IMU, TARI, bollo, RC auto, acconti delle partite IVA, rimborso del 730 a luglio. Le app sono costruite su cicli mensili all'americana, e oltre un quarto degli italiani fatica davanti a una spesa imprevista (ISTAT 2026), spesso prevedibilissima.
3. **Diritti non esercitati.** Detrazioni che mancano nel precompilato, bonus che cambiano ogni anno, welfare aziendale con soglie a gradino, rimborsi di pedaggi e treni, oltre 2 miliardi nei conti dormienti. L'Italia è tra i Paesi OCSE con l'alfabetizzazione finanziaria più bassa.
4. **Prezzi opachi senza un riferimento personale e neutrale.** L'RC auto va da 604 € a Napoli a meno di 400 € in metà delle province; un conto tradizionale costa 101 € l'anno contro 30,6 € di uno online. I comparatori vivono di provvigioni e non sanno quanto paghi tu.
5. **Il patrimonio di famiglia sta nella testa di una persona sola.** In coppia spesso una persona sola sa tutto; alla successione nessuno sa dove sono i soldi.

---

## 3. Le idee

Ogni idea ha la stessa scheda. **Fattibilità** da 1 a 5 (5 = facile con quello che abbiamo); **impatto** da 1 a 5 su acquisizione, retention e conversione a Pro.

### 1. Riprenditeli
_AI che agisce · negoziazione_

**In una frase.** FinTrack non si limita a trovare i soldi persi: apre la pratica, scrive la richiesta giusta citando la norma giusta, conta i giorni che la legge ti concede e ti avvisa quando insistere, finché i soldi non tornano.

**Il problema, e per chi.** La palestra che addebita anche dopo la disdetta, il doppio addebito, il canone del conto che sale. Chi se ne accorge quasi sempre lascia perdere: non sa a chi scrivere, con quale strumento (email, PEC, raccomandata) né entro quando. Un esempio: un addebito diretto SEPA si può far rimborsare dalla banca entro 8 settimane, ma solo se lo sai e te ne accorgi in tempo. Riguarda chiunque abbia abbonamenti o RID, cioè quasi tutti; soprattutto chi ha 30–55 anni e una famiglia, quindi più contratti.

**Perché è rivoluzionaria.** Emma, Revolut AIR e le app bancarie *trovano* abbonamenti e commissioni; AIR gestisce solo le carte Revolut e per scelta non esegue nulla. Negli USA Rocket Money negozia le bollette con persone vere e trattiene il 35–60% del risparmio. In Italia nessuno chiude il cerchio, perché il cerchio è fatto di diritto italiano: rimborso dei RID (artt. 13–14 d.lgs. 11/2010), modifiche unilaterali dei conti (art. 118 TUB), reclamo e poi Arbitro Bancario Finanziario, pulsante di recesso obbligatorio dal 19 giugno 2026, rimborsi dei pedaggi dal 1° giugno 2026. E c'è una cosa che può fare solo un'app con il tuo storico: accorgersi da sola che, *dopo* la disdetta, l'addebito è arrivato lo stesso, e prepararti la richiesta di rimborso con la scadenza già calcolata.
_Il racconto all'amico:_ «FinTrack mi ha fatto riavere 147 € dalla palestra».

**Come si aggancia.** `lib/finance/found-money.ts` (doppi addebiti, aumenti, rinnovi, commissioni, `cancellationLetter`); `normalizeDescription` in `lib/finance/recurring.ts`, per riconoscere lo stesso esercente dopo la disdetta; la tabella `found_money_dismissals`; il PDF con `@react-pdf/renderer` come il dossier 730; il digest settimanale; `lib/billing/plan.ts` per il limite tra Free e Pro.

**Fattibilità 4/5 · Effort:** MVP 5 giorni; versione completa (PDF per la raccomandata, promemoria giornalieri, invio PEC tramite un fornitore) 3–4 settimane.
**Impatto:** acquisizione 5 · retention 3 · Pro 5.

**Rischi.**
- _Legali:_ sono modelli informativi, non consulenza legale (le associazioni dei consumatori fanno lo stesso), ma i testi vanno fatti rivedere una volta da un avvocato. L'invio a nome dell'utente (fase 2) richiede un mandato esplicito a ogni invio e un fornitore PEC o raccomandata nominato responsabile del trattamento. Niente commissione sul recuperato: complicherebbe sia la fiducia sia il quadro legale.
- _Privacy:_ le lettere contengono dati personali. L'IBAN resta un segnaposto che l'utente compila nella sua email: non lo salviamo mai.
- _Fiducia:_ una lettera sbagliata costa cara, quindi ogni lettera cita le sue fonti normative e nasce come bozza da verificare.
- _Tecnici:_ con l'inserimento manuale le descrizioni sono povere (niente "SDD"), quindi si può aprire una pratica a mano da qualunque movimento.

**MVP in meno di una settimana.** Tre tipi di pratica: disdetta (con il controllo automatico degli addebiti successivi), rimborso di un addebito diretto entro 8 settimane, reclamo alla banca. Lettera precompilata da copiare o aprire nell'email, «Segna come inviata», scadenza con conto alla rovescia, esito («Recuperati 49 €»), contatore in dashboard, sezione nel digest.
_Si valida se_ almeno 1 utente su 4 tra quelli che aprono Soldi ritrovati apre una pratica, e almeno 1 pratica inviata su 3 si chiude con soldi recuperati (soglie da tarare).

### 2. Lo stipendio vero
_Previsioni · risparmio automatico · fisco_

**In una frase.** Un solo numero in dashboard: quanto puoi spendere oggi senza pensieri, con le stangate dell'anno (IMU, bollo, RC auto, TARI, regali, vacanze, acconti delle tasse) già messe da parte e la tredicesima spalmata sui mesi.

**Il problema, e per chi.** Gran parte degli "imprevisti" italiani non lo sono affatto: bollo, assicurazione, IMU e TARI arrivano ogni anno nello stesso mese. Ma l'anno finanziario italiano è irregolare: tredicesima a dicembre, quattordicesima a luglio per alcuni contratti, rimborso del 730 in estate, acconti di giugno e novembre per le partite IVA. Riguarda i dipendenti con tredicesima, chi ha casa e auto, e i forfettari (242.529 nuove aperture nel solo 2025) che ogni giugno scoprono saldo più acconto.

**Perché è rivoluzionaria.** Il "safe to spend" esiste (PocketGuard, Copilot), ma su cicli mensili all'americana; YNAB ti fa creare a mano i fondi per le spese annuali; HYPE Business accantona le tasse solo dentro il suo conto aziendale. Nessuno ricava il calendario delle stangate dal tuo storico e dalle scadenze italiane, e nessuno mette insieme vita privata e partita IVA.
_Il racconto all'amico:_ «la mia app sapeva del bollo prima di me».

**Come si aggancia.** `lib/finance/recurring.ts` riconosce già gli addebiti annuali e trimestrali con la data prevista; `lib/finance/forecast.ts` passa da 45 giorni a 12 mesi; l'hero «Soldi disponibili» che state introducendo (`components/dashboard/available-hero.tsx`) diventa «Stipendio vero»; gli accantonamenti diventano obiettivi (`Goal`); servono anche `monthlyNetIncome` e il pilastro "cuscinetto" del coach.

**Fattibilità 5/5 · Effort:** MVP 4–5 giorni; versione completa (calcolo di bollo e IMU, modulo forfettari) 2–3 settimane.
**Impatto:** acquisizione 3 · retention 5 · Pro 3.

**Rischi.**
- _Legali:_ bassi. Sono stime informative; per i forfettari va scritto chiaro «stima: verifica con il commercialista», perché non è assistenza fiscale.
- _Regole da mantenere:_ il bollo dipende dalla regione, IMU e TARI dal comune.
- _Fiducia:_ un numero sbagliato in prima pagina fa danni, quindi «come l'ho calcolato» deve stare sempre a un tocco.
- _Novità:_ moderata. Il concetto esiste; la versione italiana no.

**MVP in meno di una settimana.** Calendario dei prossimi 12 mesi, costruito dagli addebiti annuali e trimestrali già riconosciuti più una lista di stangate italiane da spuntare con l'importo dell'anno scorso. Ne esce un accantonamento mensile, e lo stipendio vero è: disponibile − spese fisse fino al prossimo stipendio − quota delle stangate non ancora accantonata. Opzione «spalma la tredicesima».
_Si valida se_ chi lo attiva apre l'app più spesso: almeno +20% di sessioni settimanali rispetto a chi non lo usa.

### 3. Il Tariffometro
_Community · negoziazione_

**In una frase.** Per ogni bolletta e abbonamento ricorrente, FinTrack ti mostra quanto pagano davvero le persone come te nella tua provincia, con dati veri e anonimi, e ti prepara la mossa per pagare meno.

**Il problema, e per chi.** I prezzi sono opachi e molto dispersi. L'RC auto media va da 604 € a Napoli a meno di 400 € in metà delle province (IVASS, 2° trimestre 2026). Un conto tradizionale costa in media 101 € l'anno, uno online 30,6 € (Banca d'Italia). Nella luce, solo lo 0,5% delle offerte del mercato libero batteva il servizio di riferimento (ARERA, 2024). Senza un riferimento personale nessuno sa se sta pagando troppo. Riguarda tutte le famiglie.

**Perché è rivoluzionaria.** I comparatori (Segugio, Facile.it) vivono di provvigioni e non sanno quanto paghi tu; le associazioni organizzano acquisti collettivi a campagne. Nessuna app usa gli importi realmente pagati dai suoi utenti per costruire un riferimento. È un effetto rete: più utenti, riferimento migliore, vantaggio difficile da copiare.
_Il racconto all'amico:_ «pagavo internet il 40% in più dei miei vicini».

**Come si aggancia.** Ricorrenti (`monthlyCost`, `priceChange`), chiave dell'esercente (`normalizeDescription`), categorie, valuta dello spazio. Da aggiungere: provincia e numero di componenti nel profilo, consenso esplicito al confronto anonimo. Per partire senza utenti si usano dati pubblici: IVASS IPER (RC auto per provincia), l'indagine della Banca d'Italia sul costo dei conti, gli open data del Portale Offerte ARERA.

**Fattibilità 3/5 · Effort:** MVP con soli dati pubblici 5 giorni; confronto collettivo 4–6 settimane, più una base di utenti sufficiente (almeno 20 persone per ogni combinazione di provincia e voce).
**Impatto:** acquisizione 5 · retention 3 · Pro 4.

**Rischi.**
- _Privacy:_ mettere insieme i dati di spazi diversi è un nuovo trattamento. Servono consenso esplicito, soglia di anonimato (almeno 20 persone per dato), un po' di rumore sui valori e, consigliata, una valutazione d'impatto (DPIA).
- _Legali:_ niente link a pagamento verso le assicurazioni, perché diventerebbe distribuzione assicurativa e richiederebbe l'iscrizione al RUI. Per l'energia si rimanda al Portale Offerte, che è neutrale.
- _Tecnici:_ riconoscere lo stesso esercente con descrizioni diverse a seconda della banca.

**MVP in meno di una settimana.** Tre voci con dati pubblici: RC auto (premio inserito contro la media della provincia), costo del conto (commissioni rilevate contro le medie della Banca d'Italia), luce (€/kWh dalla bolletta, inserito a mano, contro le offerte del Portale). Intanto si chiede il consenso ai dati anonimi, così il confronto collettivo parte già popolato.
_Si valida se_ almeno il 15% di chi vede un confronto «sopra la media» fa qualcosa (lettera, cambio di fornitore, promemoria).

### 4. Radar dei diritti
_Fisco e burocrazia italiana_

**In una frase.** Ogni primavera FinTrack mette il tuo 730 precompilato accanto alle spese che ha visto passare e ti dice cosa manca e quanto vale; tutto l'anno ti avvisa di detrazioni, bonus e crediti welfare che stai per perdere.

**Il problema, e per chi.** Il precompilato contiene solo ciò che arriva all'Agenzia delle Entrate. Spesso mancano lo sport dei figli, le rette, il veterinario e soprattutto l'affitto: i giovani tra 20 e 31 anni con reddito basso possono detrarre il 20% del canone fino a 2.000 €, gli inquilini con reddito basso 300 o 150 €. Il welfare aziendale ha una soglia a gradino (nel 2026 1.000 €, 2.000 € con figli: superarla anche di un euro rende tassato tutto) e crediti da usare entro una data. I bonus cambiano a ogni legge di bilancio (nel 2026: elettrodomestici con ISEE sotto 25.000 €, bonus mamme, contributo per le scuole paritarie). Riguarda famiglie con figli, giovani in affitto, dipendenti con welfare aziendale.

**Perché è rivoluzionaria.** CAF e patronati lavorano su appuntamento e a stagione; il precompilato usa solo i dati che riceve; nessuna app incrocia tutto l'anno le spese reali con le regole italiane. FinTrack ha già il motore delle detrazioni: è l'estensione naturale del suo tratto più distintivo.
_Il racconto all'amico:_ «nel precompilato mancavano 412 € di spese: 78 € di rimborso in più».

**Come si aggancia.** `lib/finance/deductions.ts` (`RULES`, `summarizeDeductions`), il dossier PDF, `dependentChildren`, la categoria Affitto, il reddito netto. Da aggiungere: età, fascia di reddito, credito welfare disponibile con la sua scadenza.

**Fattibilità 3/5 · Effort:** MVP 5 giorni; versione completa 4 settimane (lettura del PDF del precompilato nel browser, catalogo dei bonus), più l'aggiornamento delle regole a ogni legge di bilancio.
**Impatto:** acquisizione 5 (picco stagionale da aprile a settembre) · retention 3 · Pro 5.

**Rischi.**
- _Legali:_ FinTrack informa, non presta assistenza fiscale (compilare e trasmettere per conto d'altri spetta a CAF e professionisti). L'utente corregge il suo 730 da sé.
- _Privacy:_ il precompilato contiene dati sanitari, quindi si legge nel browser e non si salva.
- _Fiducia:_ una regola sbagliata è una falsa speranza. La data di verifica delle regole deve essere sempre visibile (`RULES_CHECKED_AT` esiste già).
- _Nota critica:_ il "pacchetto ISEE" (saldo al 31/12 e giacenza media di ogni conto) per chi inizia oggi rende solo dal 2028, e l'ISEE precompilato dell'INPS prende già i dati dalle banche. È un extra, non il cuore dell'idea.

**MVP in meno di una settimana.**
1. Le detrazioni per l'affitto (giovani e inquilini) entrano nel motore esistente.
2. «Confronta col precompilato»: l'utente inserisce i totali per tipo che vede nel suo precompilato, FinTrack mostra le differenze e il rimborso in più.
3. Promemoria del welfare: saldo, scadenza, soglia.

_Si valida se_ nella stagione del 730 2027 almeno il 20% degli utenti attivi usa il confronto, e metà trova almeno una differenza.

### 5. Il crash test
_Previsioni · psicologia del denaro_

**In una frase.** Che succede se domani perdi il lavoro, si rompe l'auto o arriva un figlio? FinTrack lo simula sui tuoi numeri, con NASpI e assegno unico già calcolati, e ti dà un verdetto in mesi: «reggi 7 mesi».

**Il problema, e per chi.** La paura dei soldi è vaga, e proprio per questo paralizza. Pochi sanno quanto vale la propria NASpI o quanto dura; quasi metà degli italiani non riuscirebbe a coprire una spesa di 5.000 € (solo il 51% ce la farebbe). Riguarda dipendenti, famiglie giovani e chi ha un mutuo variabile.

**Perché è rivoluzionaria.** I simulatori calcolano interessi composti; le banche fanno stress test sui propri bilanci, mai su quelli delle famiglie. Nessuno combina il flusso di cassa reale con le regole del welfare italiano: NASpI (importo, massimale, riduzione mensile, durata), assegno unico, costi medi di un figlio.
_Il racconto all'amico:_ «ho fatto il crash test: reggo 4 mesi, adesso so quanto mettere da parte».

**Come si aggancia.** `lib/finance/forecast.ts`, `lib/finance/projection.ts`, il pilastro "cuscinetto" di `lib/finance/coach.ts`, i debiti, `lib/finance/affordability.ts`, `monthlyNetIncome`.

**Fattibilità 4/5 · Effort:** MVP 4 giorni; versione completa 2 settimane.
**Impatto:** acquisizione 4 · retention 3 · Pro 3.

**Rischi.** I parametri INPS cambiano ogni anno. C'è il rischio di generare ansia: ogni verdetto si chiude con un'azione (l'obiettivo «fondo emergenza» già pronto) e mai con un prodotto finanziario. Nessuna consulenza.

**MVP in meno di una settimana.** Tre scenari, senza probabilità: perdita del lavoro (NASpI stimata da reddito e anni di lavoro dichiarati), spesa imprevista (1.500 o 5.000 €), rata del mutuo più alta di 2 punti. Il risultato: mesi di autonomia e il giorno in cui il saldo va sotto zero, segnato sul grafico della previsione. Una card da condividere senza importi, come quelle delle storie.
_Si valida se_ il 30% di chi fa il test crea o alimenta l'obiettivo fondo emergenza entro 7 giorni.

### 6. Mio, tuo, nostro
_Coppia e famiglia_

**In una frase.** La coppia condivide il "nostro" (spese comuni, casa, obiettivi) senza rinunciare al "mio": ognuno vede dell'altro solo i totali che l'altro sceglie di mostrare. Una volta al mese FinTrack prepara «Il caffè dei conti», 15 minuti guidati con l'agenda già scritta dai dati.

**Il problema, e per chi.** Il 49% delle coppie ha un conto cointestato per le spese di tutti i giorni, ma il 37% dei millennial preferisce conti separati (indagini citate nelle fonti). Gli strumenti sono tutto o niente: o vedi ogni caffè del partner, o non vedi nulla. E di soldi si parla solo quando c'è un problema. Riguarda coppie conviventi e famiglie giovani.

**Perché è rivoluzionaria.** Honeydue (USA) offre una condivisione parziale; Splitwise divide e basta. Nessuno guida la conversazione con i dati: cosa è andato bene, cosa decidere, chi ha contribuito quanto rispetto al reddito. La parte nuova è il rituale, non la privacy.
_Il racconto all'amico:_ «ogni primo del mese facciamo il caffè dei conti e non litighiamo più sulla spesa».

**Come si aggancia.** `Household` e `HouseholdMember`, `lib/finance/split.ts` (a metà o in proporzione al reddito), `Settlement`, gli obiettivi, il formato delle storie per il rituale, il motore del coach per l'agenda.

**Fattibilità 3/5 · Effort:** MVP 4 giorni (solo il rituale, sugli spazi condivisi che esistono già); versione completa 3–4 settimane, perché la visibilità per conto tocca ogni query sui dati e va trattata come codice di sicurezza.
**Impatto:** acquisizione 4 (ogni utente porta il partner) · retention 5 · Pro 3.

**Rischi.** Un bug di visibilità mostra al partner ciò che non doveva vedere: servono test di autorizzazione dedicati. Violenza economica: nessuna funzione "di controllo"; la privacy del "mio" è proprio la protezione.

**MVP in meno di una settimana.** «Il caffè dei conti»: 5 slide (com'è andato il mese comune, quanto ha messo ciascuno rispetto al reddito, gli obiettivi, una decisione da prendere, una cosa da festeggiare) più un registro delle decisioni.
_Si valida se_ il 40% degli spazi con più persone lo usa due mesi di fila.

### 7. Il fascicolo di famiglia (folle ma possibile)
_Famiglia · fiducia_

**In una frase.** La mappa di tutto ciò che possiedi e devi (conti, investimenti, polizze, debiti, abbonamenti da disdire, dove sono i documenti, chi chiamare) che, se smetti di rispondere per 60 giorni, arriva alla persona di cui ti fidi.

**Il problema, e per chi.** Quando qualcuno muore o finisce in ospedale, la famiglia non sa dove sono i soldi. In Italia ci sono 1,1 milioni di rapporti dormienti per oltre 2 miliardi di euro; la dichiarazione di successione richiede l'elenco completo dei rapporti; e spesso, in coppia, una sola persona sa tutto. Riguarda coppie, genitori, over 50, figli che seguono genitori anziani.

**Perché è rivoluzionaria.** Google ha l'Inactive Account Manager per i propri dati; negli USA esistono servizi a parte (Everplans, Trustworthy). In Italia nessuna app di finanza personale lo fa, e nessuno lo costruisce da dati vivi: FinTrack sa già quali conti, debiti e abbonamenti hai.
_Il racconto all'amico:_ «se mi succede qualcosa, mia moglie trova tutto in un PDF».

**Come si aggancia.** Spazi e membri, conti (anche quelli archiviati), investimenti, debiti, ricorrenti (cosa disdire), export JSON (`/api/account/export`), PDF, cron, email.

**Fattibilità 4/5 per il fascicolo, 3/5 per l'invio automatico · Effort:** MVP 4 giorni; versione completa 3 settimane.
**Impatto:** acquisizione 3 · retention 4 (si aggiorna nel tempo, e chi l'ha compilato difficilmente se ne va) · Pro 4.

**Rischi.**
- _Fiducia:_ altissima, perché un invio per errore è una fuga di dati. Servono avvisi a 30, 45 e 55 giorni, la conferma della persona di fiducia, una finestra per annullare, un link firmato che scade e, di default, "dove" ma non "quanto". Mai credenziali.
- _Privacy:_ l'art. 2-terdecies del Codice privacy regola i dati delle persone decedute: la scelta è dell'utente e va documentata.
- _Legali:_ non è un testamento, e va detto chiaramente.

**MVP in meno di una settimana.** Fascicolo PDF generato a richiesta dai dati esistenti, più note libere (documenti, contatti del commercialista, polizze), più un «condividi con…» manuale tramite link a scadenza. L'invio automatico arriva solo dopo aver misurato l'interesse.
_Si valida se_ il 10% degli utenti attivi genera il fascicolo e metà di loro lo condivide.

### 8. Il patto (folle ma possibile)
_Psicologia del denaro · social_

**In una frase.** Scommetti contro te stesso: «se a novembre spendo più di 150 € in delivery, Marco lo saprà e 30 € andranno alla causa che detesto». Un amico fa da arbitro e a fine mese FinTrack controlla da sola.

**Il problema, e per chi.** Sapere non basta: i budget falliscono perché sforarli non costa niente. Gli impegni vincolanti funzionano: nel programma SEED (Ashraf, Karlan e Yin, 2006) chi aveva un risparmio vincolato ha risparmiato di più, e stickK è costruito su questo. Riguarda chi ha 20–40 anni, spende d'impulso e ha un gruppo di amici.

**Perché è rivoluzionaria.** stickK è generico e si basa sull'autodichiarazione. Nessuna app di finanza lega un patto ai dati di spesa reali e lo rende sociale.
_Il racconto all'amico:_ «ho perso il patto e 30 € sono finiti ai tifosi della squadra rivale».

**Come si aggancia.** Budget (`getBudgetsWithSpending`, soglie), il motore della gamification (badge, streak), la «sfida della settimana» del coach, l'immagine condivisibile delle storie, gli inviti già esistenti per l'arbitro.

**Fattibilità 4/5 con una posta sociale, 2/5 con soldi veri · Effort:** MVP 4 giorni; con denaro vero 4 settimane o più.
**Impatto:** acquisizione 4 (virale) · retention 4 · Pro 2.

**Rischi.**
- _Legali:_ con denaro vero FinTrack incasserebbe e girerebbe soldi a terzi, cioè servizi di pagamento. Si può fare solo tramite una piattaforma di donazioni che fa da esercente. Meglio evitare i partiti politici (obblighi di trasparenza, rischio reputazionale).
- _Tecnici:_ i dati inseriti a mano si possono truccare; va bene così, il patto è con te stesso.
- _Fiducia:_ la "vergogna" deve essere scelta, e gentile.

**MVP in meno di una settimana.** Patto con una posta solo sociale: l'arbitro viene invitato con un link (senza account), la verifica a fine mese è automatica sul budget, l'esito si può condividere. In alternativa la "multa" va in un tuo obiettivo di risparmio.
_Si valida se_ chi ha un patto attivo rispetta il budget più spesso di chi non ce l'ha (almeno 15 punti in più).

### 9. Radiografia dei costi
_Investimenti · ⚠️ vicina alla consulenza_

**In una frase.** Inserisci i fondi e le polizze che ti ha venduto la banca: FinTrack legge i costi dal KID e ti mostra quanti euro ti costano in 10, 20 e 30 anni.

**Il problema, e per chi.** Un costo dell'1,8% l'anno sembra niente; su 50.000 € in 20 anni sono decine di migliaia di euro di rendimento perso. I costi in percentuale non si vedono. Riguarda chi ha 35–65 anni e prodotti sottoscritti in banca.

**Perché è rivoluzionaria.** I robo-advisor lo usano come pubblicità (conflitto d'interessi), le banche non mostrano mai il costo cumulato in euro, le app di budget ignorano i costi. L'ESMA documenta che i costi scendono lentamente, soprattutto nei fondi già esistenti.

**Come si aggancia.** Il modulo investimenti appena costruito (`lib/finance/investments.ts`, `InvestmentValuation`), il simulatore per la proiezione, i report PDF.

**Fattibilità 3/5 (ogni KID in PDF è diverso) · Effort:** MVP 3 giorni; versione completa 2 settimane.
**Impatto:** acquisizione 4 · retention 2 · Pro 4.

**Rischi.** ⚠️ **Molto vicina alla consulenza finanziaria.** Una raccomandazione personalizzata su strumenti specifici è consulenza in materia di investimenti, attività riservata (TUF, art. 1, comma 5-septies).
**Alternativa conforme:** mostrare solo i costi dichiarati nel KID del prodotto e medie di categoria pubbliche (ESMA). Mai «vendi» o «compra», mai alternative con un nome. Il risultato è una lista di «domande da fare al tuo consulente», coerente con la regola che il coach già rispetta.

**MVP in meno di una settimana.** Inserimento manuale dei costi correnti e una tantum letti dal KID, poi la curva del costo cumulato in euro accanto al valore, con un riferimento neutro: il costo medio della categoria secondo l'ESMA.
_Si valida se_ il 30% di chi ha conti investimento la usa.

### Le idee che ho scartato

| Idea | Perché no |
| --- | --- |
| Bot WhatsApp o Telegram per registrare le spese | Utile per la retention, ma è un canale, non un'idea che si racconta. Va tenuto come miglioramento rapido |
| Plusvalenze e quadro RW per le cripto | Aliquota al 33% e DAC8 sono novità vere, ma è una nicchia già coperta da strumenti specializzati, e gli exchange italiani iniziano a pagare le imposte per conto del cliente |
| Funzioni per l'euro digitale | Prima emissione nel 2029: oggi non c'è niente da costruire |
| Un agente che paga da solo (Agent Pay, pagamenti PSD2) | Richiede una licenza o un partner regolamentato, e il rischio è enorme. Da rivedere dopo la PSR |
| Scontrino fotografato e letto dall'AI | Ormai lo fanno tutti (Splitwise, Tricount). Utile come pezzo del Radar dei diritti (scontrini parlanti della farmacia), non come idea a sé |
| «Il te del futuro» (foto invecchiata, lettera dal 2036) | Gli studi di Hershfield mostrano un effetto sul risparmio, ma lo stupore dura un giorno: al massimo una slide delle storie |
| Robo-advisor o consigli di portafoglio | Vietato senza autorizzazione, e fuori dal nostro posizionamento |
| Gruppo d'acquisto per le bollette | Esiste già (Altroconsumo), richiede una massa critica e accordi con i fornitori che toglierebbero neutralità |

---

## 4. La scelta

### Impatto × fattibilità

L'**impatto** è la media di acquisizione, retention e Pro. L'**unicità** misura quanto l'idea ci distingue dai concorrenti, che è l'obiettivo di questo lavoro, e conta più del punteggio quando il punteggio è vicino.

| # | Idea | Fattibilità | Acq. | Ret. | Pro | **Impatto** | Impatto × fatt. | Unicità | Effort (MVP / completa) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Riprenditeli** | 4 | 5 | 3 | 5 | **4,3** | 17,3 | 5 | 5 gg / 3–4 sett. |
| 2 | **Lo stipendio vero** | 5 | 3 | 5 | 3 | **3,7** | 18,3 | 3 | 4–5 gg / 2–3 sett. |
| 4 | **Radar dei diritti** | 3 | 5 | 3 | 5 | **4,3** | 13,0 | 4 | 5 gg / 4 sett. |
| 7 | Il fascicolo di famiglia 🌀 | 4 | 3 | 4 | 4 | 3,7 | 14,7 | 5 | 4 gg / 3 sett. |
| 5 | Il crash test | 4 | 4 | 3 | 3 | 3,3 | 13,3 | 4 | 4 gg / 2 sett. |
| 8 | Il patto 🌀 | 4 | 4 | 4 | 2 | 3,3 | 13,3 | 4 | 4 gg / 4+ sett. |
| 3 | Il Tariffometro | 3 | 5 | 3 | 4 | 4,0 | 12,0 | 5 | 5 gg / 4–6 sett. + utenti |
| 6 | Mio, tuo, nostro | 3 | 4 | 5 | 3 | 4,0 | 12,0 | 3 | 4 gg / 3–4 sett. |
| 9 | Radiografia dei costi ⚠️ | 3 | 4 | 2 | 4 | 3,3 | 10,0 | 3 | 3 gg / 2 sett. |

🌀 = folle ma possibile · ⚠️ = vicina alla consulenza finanziaria (alternativa conforme nella scheda)

```
                 FATTIBILITÀ →
                 3 (serve lavoro)                     4                                   5 (subito)
IMPATTO  4,3  │  Radar dei diritti                    Riprenditeli                       │
         4,0  │  Tariffometro · Mio, tuo, nostro                                         │
         3,7  │                                       Fascicolo di famiglia               Stipendio vero
         3,3  │  Radiografia dei costi                Crash test · Il patto              │
```

### Le 3 da fare per prime, e perché

**1. Riprenditeli: subito, ottobre e novembre 2026.**
È l'idea con il miglior equilibrio tra unicità (5), impatto (4,3) e fattibilità (4). Trasforma «Soldi ritrovati», già il nostro tratto più distintivo e il motivo per passare a Pro, in un numero che si racconta: *euro recuperati*. Questo numero diventa marketing («gli utenti FinTrack hanno recuperato 12.430 €») e giustifica l'abbonamento meglio di qualunque funzione. Il 2026 ci regala gli appigli normativi (pulsante di recesso, rimborsi dei pedaggi), l'MVP non dipende da nessun servizio esterno, e prepara la base dati per il Tariffometro.

**2. Lo stipendio vero: da metà novembre, lancio entro inizio dicembre 2026.**
Ha il prodotto impatto × fattibilità più alto (18,3) ed è il motore di retention che manca: un numero che vale la pena guardare ogni giorno. Non è prima solo perché l'idea in sé non è nuova; la versione italiana sì. Ha una finestra perfetta: tredicesima, saldo IMU del 16 dicembre e regali arrivano tutti nello stesso mese. Il lancio si scrive da solo: «il primo dicembre senza sorprese». E si innesta sull'hero «Soldi disponibili» che state già costruendo.

**3. Radar dei diritti: gennaio–marzo 2027, pronto per l'apertura del precompilato (fine aprile 2027).**
Ha lo stesso impatto di Riprenditeli e porta il picco di acquisizione più prevedibile dell'anno: tra aprile e settembre milioni di italiani cercano "730 precompilato". La data non si sposta, quindi va pianificato adesso. Estende un motore che c'è già (`deductions.ts`) e converte a Pro, perché il dettaglio delle detrazioni è già una funzione Pro.

**Perché non le altre, per ora.**
- **Tariffometro:** ha impatto 4 e unicità 5, ma il suo valore vero (il confronto collettivo) richiede migliaia di utenti. Riprenditeli e lo Stipendio vero raccolgono già, a costo zero, ciò che gli serve (chiavi degli esercenti, provincia, consenso). Va costruito quando la base c'è.
- **Mio, tuo, nostro:** la visibilità per conto è una modifica di sicurezza che tocca ogni query. Va fatta con calma, dopo.
- **Fascicolo di famiglia:** è il miglior "jolly". Il suo MVP (solo il PDF) costa pochi giorni e si può infilare tra un rilascio e l'altro; l'invio automatico richiede prima che gli utenti si fidino di noi.

### In parallelo: la connessione bancaria

Non è un'idea rivoluzionaria (ce l'hanno tutti), ma condiziona tutte quelle che riconoscono qualcosa in automatico (1, 2, 3, 4). Oggi i dati arrivano a mano o da CSV. Indicazioni:
- Tenere inserimento rapido e CSV come strada principale. Sono anche un argomento di privacy: «nessun accesso alla tua banca».
- Dopo aver validato Riprenditeli, valutare **un** aggregatore con licenza AISP e copertura italiana (Enable Banking, Salt Edge, Tink, Fabrick). La versione gratuita di GoCardless/Nordigen non accetta più nuove iscrizioni.
- Mettere in conto un costo per utente collegato e il rinnovo del consenso ogni 180 giorni. Ha senso solo come funzione Pro, e la PSR (2027–2028) renderà le API più affidabili.

### Calendario suggerito

| Periodo | Cosa |
| --- | --- |
| ottobre – metà novembre 2026 | Riprenditeli: MVP in una settimana, poi la versione completa |
| metà novembre – inizio dicembre 2026 | Lo stipendio vero, lanciato prima della tredicesima |
| dicembre 2026 | MVP del Fascicolo di famiglia (solo PDF), come regalo di fine anno |
| gennaio – marzo 2027 | Radar dei diritti |
| fine aprile 2027 | Lancio del Radar con l'apertura del precompilato |
| dopo | Tariffometro (quando la base utenti lo consente), Mio, tuo, nostro, connessione bancaria |

---

## 5. Piano di implementazione: Riprenditeli

### Perimetro dell'MVP

Tre tipi di pratica, invio **manuale** (l'utente copia la lettera o la apre nella sua email), nessun servizio esterno nuovo.

| Tipo | Quando nasce | A chi scrive | Scadenza calcolata |
| --- | --- | --- | --- |
| **Disdetta** | Da un abbonamento (Soldi ritrovati o Abbonamenti) | Al fornitore | Nessuna; dopo l'invio FinTrack controlla gli addebiti successivi alla data di efficacia |
| **Rimborso di un addebito diretto** | Da un movimento SDD/RID, o da un addebito arrivato dopo una disdetta | Alla propria banca | **Da fare entro** la data dell'addebito + 8 settimane (56 giorni) |
| **Reclamo alla banca** | Da una commissione o da un doppio addebito che l'utente contesta | All'ufficio reclami della banca | **Risposta attesa entro** 15 giornate operative per i servizi di pagamento (prorogabili a 35) o 60 giorni per gli altri; poi c'è l'Arbitro Bancario Finanziario (20 €, restituiti se si vince) |

In più, il doppio addebito di un esercente apre una pratica verso l'esercente stesso, con lo stesso modello del reclamo.

**Free e Pro**, coerenti con `lib/billing/plan.ts`: Free ha una pratica aperta alla volta e il contatore; Pro ha pratiche illimitate, PDF per la raccomandata e promemoria.

### Schema Prisma

Da aggiungere a `prisma/schema.prisma`, nello stile dei modelli esistenti:

```prisma
/// What a "Riprenditeli" claim asks for.
enum ClaimKind {
  /// Cancel a subscription; afterwards FinTrack watches for charges past the effective date.
  CANCELLATION
  /// Refund of a SEPA direct debit, within 8 weeks of the charge (artt. 13-14 d.lgs. 11/2010).
  DIRECT_DEBIT_REFUND
  /// Complaint to the bank (fees, a charge taken twice); then the Arbitro Bancario Finanziario.
  BANK_COMPLAINT
  /// A merchant charged twice: ask the merchant first.
  DUPLICATE_CHARGE
}

enum ClaimStatus {
  DRAFT
  SENT
  WON
  PARTIAL
  LOST
  DROPPED
}

/// "Riprenditeli": a request to get money back or stop paying, from draft to outcome.
model Claim {
  id              String      @id @default(cuid())
  householdId     String      @map("household_id")
  /// Who opened it and sends it in their own name (null if they deleted their account).
  userId          String?     @map("user_id")
  kind            ClaimKind
  status          ClaimStatus @default(DRAFT)
  /// The "Soldi ritrovati" finding it started from (dup:…, price:…, fees, a subscription key).
  findingKey      String?     @map("finding_key")
  /// The charge being contested, if any.
  transactionId   String?     @map("transaction_id")
  /// Who the letter goes to: the merchant, the provider or the bank.
  counterparty    String
  /// Expected money back (one-off), or saved per year for a CANCELLATION; household currency.
  expectedAmount  Decimal     @map("expected_amount") @db.Decimal(14, 2)
  /// What actually came back or was saved, set when the claim is closed.
  recoveredAmount Decimal?    @map("recovered_amount") @db.Decimal(14, 2)
  /// The letter as the user sends it. Bank details stay placeholders: never stored here.
  subject         String
  body            String
  /// email | pec | raccomandata | app | sportello
  channel         String?
  sentAt          DateTime?   @map("sent_at") @db.Date
  /// CANCELLATION: the day from which the service must no longer be charged.
  effectiveFrom   DateTime?   @map("effective_from") @db.Date
  /// DRAFT: last day to act; SENT: last day for the other side to answer (lib/finance/claims.ts).
  deadline        DateTime?   @db.Date
  closedAt        DateTime?   @map("closed_at")
  notes           String?
  createdAt       DateTime    @default(now()) @map("created_at")
  updatedAt       DateTime    @updatedAt @map("updated_at")

  household   Household    @relation(fields: [householdId], references: [id], onDelete: Cascade)
  user        User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  transaction Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)

  /// One claim per finding (NULLs don't collide in Postgres, so manual claims are free).
  @@unique([householdId, findingKey])
  @@index([householdId, status])
  @@index([status, deadline])
  @@map("claims")
}
```

Relazioni inverse da aggiungere: `claims Claim[]` in `Household`, `User` e `Transaction`.

**Migrazione, in sicurezza.** C'è un solo database Neon per locale e produzione; il 30/09/2026 un `migrate diff` con shadow database l'ha azzerato.
1. Applicare prima le migrazioni in sospeso (`20261006090000_investments`) con `npx prisma migrate deploy`.
2. Generare l'SQL **in sola lettura**: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`. Salvarlo in `prisma/migrations/2026MMDDhhmmss_claims/migration.sql` e rileggerlo: deve contenere **solo** enum, tabella e indici di `claims`.
3. Applicarlo con `npx prisma migrate deploy`.
4. **Mai** `migrate dev`, `migrate reset` o uno `--shadow-database-url` che punti a Neon. Alla fine, verificare che gli utenti reali ci siano ancora.

### Logica pura: `lib/finance/claims.ts` (nuovo)

Funzioni senza database, come il resto di `lib/finance/`, tutte con test:

| Funzione | Cosa fa |
| --- | --- |
| `refundDeadline(chargeDate)` | Data dell'addebito + 56 giorni |
| `looksLikeDirectDebit(description)` | Riconosce `SDD`, `RID`, «addebito diretto», «addebito SEPA», «mandato» nelle descrizioni bancarie |
| `italianHolidays(year)` | Festività nazionali con Pasquetta (calcolo della Pasqua) e **4 ottobre dal 2026** (San Francesco) |
| `addBusinessDays(date, n)` | Somma giornate operative, saltando sabati, domeniche, festività e, per prudenza, i semifestivi 24/12 e 31/12: così la scadenza della banca non risulta mai troppo presto |
| `answerDeadline(kind, sentAt, topic)` | 15 giornate operative per i servizi di pagamento, 60 giorni di calendario per gli altri servizi bancari |
| `chargesAfterCancellation(claims, transactions)` | Uscite con la stessa chiave `normalizeDescription` della disdetta, datate dalla data di efficacia in poi e non ancora contestate; per ognuna, il rimborso da chiedere entro `refundDeadline` |
| `draftFromFinding(finding)` | Traduce un ritrovamento (doppio addebito, aumento, rinnovo, commissioni, abbonamento) in tipo, destinatario e importo atteso |
| `nextStep(claim, today)` | Il prossimo passo, da mostrare e da usare nel digest: «Mancano 5 giorni per chiedere il rimborso», «La banca non ha risposto: puoi rivolgerti all'ABF», «Ti hanno addebitato dopo la disdetta» |
| `summarizeClaims(claims)` | Recuperati una tantum, risparmio annuo dalle disdette, pratiche aperte, in scadenza entro 7 giorni |

Piccola modifica a `lib/finance/found-money.ts`: `Duplicate` riceve anche `transactionId`. Oggi l'id è solo dentro la chiave `dup:…`.

### Lettere: `lib/claims/letters.ts` (nuovo)

Un modello per ogni tipo, con la data in italiano e gli importi in formato `it-IT`. `cancellationLetter` si sposta qui, ampliata con la data di efficacia e, per i contratti online, il riferimento al pulsante di recesso. Numero cliente, IBAN e codice del mandato restano **segnaposto** (`[IBAN]`, `[numero cliente]`) da completare nella propria email. Ogni lettera cita la norma su cui si basa. **Prima del lancio, una revisione una tantum dei testi da parte di un avvocato o di un'associazione di consumatori.**

### Dati, validazione e azioni

- **`lib/data/claims.ts`** (nuovo): `getClaims(householdId)`, con il movimento collegato, e `getClaimSuggestions(householdId)`, cioè addebiti diretti degli ultimi 56 giorni e addebiti arrivati dopo una disdetta. `getFoundMoney` riceve una mappa ritrovamento → pratica, così ogni ritrovamento mostra «Pratica aperta» o «Recuperati 49 €».
- **`lib/validations/claims.ts`** (nuovo, zod): apertura (tipo, ritrovamento o movimento, destinatario, importo nel formato degli importi di `lib/validations/finance.ts`); lettera (oggetto fino a 200 caratteri, testo fino a 8.000); invio (canale tra quelli ammessi, data non futura, data di efficacia per le disdette); esito (`WON`/`PARTIAL` richiedono l'importo recuperato, mai negativo).
- **`app/(dashboard)/ritrovati/pratiche/actions.ts`** (nuovo): `openClaim`, `updateClaimLetter` (solo in bozza), `markClaimSent` (ricalcola la scadenza), `recordClaimOutcome`, `deleteClaim`. Ogni scrittura usa `where: { id, householdId: space.id }` come `setDeduction`, così nessuno può toccare le pratiche di un altro spazio. Il limite del piano Free si controlla sul server con lo stesso schema di `requirePro()`.

### Pagine e route

| Percorso | Cosa |
| --- | --- |
| `app/(dashboard)/ritrovati/pratiche/page.tsx` | Contatore «Recuperati», suggerimenti in alto («Ti hanno addebitato dopo la disdetta»), poi Da fare (per scadenza), In attesa di risposta, Chiuse |
| `app/(dashboard)/ritrovati/pratiche/[id]/page.tsx` | Avanzamento (Bozza → Inviata → Esito), lettera modificabile con «Copia» e «Apri nell'email» (`mailto:`), riquadro della scadenza, «Com'è finita?» |
| `app/api/ritrovati/pratiche/[id]/pdf/route.tsx` | La lettera in PDF per la raccomandata (Pro), con lo stile del dossier 730. Si può fare il giorno dopo l'MVP |
| Fase 2: `app/api/cron/claims/route.ts` + `vercel.json` | Controllo giornaliero delle scadenze entro 3 giorni, con email. Nell'MVP basta il digest del lunedì |

Nessuna nuova voce nel menu: le pratiche vivono dentro Soldi ritrovati.

### Componenti: `components/claims/` (nuovi)

`claims-board.tsx` (le sezioni), `claim-card.tsx`, `claim-deadline.tsx` (conto alla rovescia, i cui colori cambiano con l'urgenza), `claim-letter.tsx` (testo, copia, `mailto:`), `claim-stepper.tsx`, `claim-outcome-dialog.tsx`, `open-claim-button.tsx`, `recovered-total.tsx` (riusa `AnimatedCurrency`). Per l'eliminazione si riusa `confirm-delete-dialog.tsx`.

### Collegamenti con l'esistente

- `components/found-money/found-money-view.tsx`: pulsante «Riprenditeli» su doppi addebiti, aumenti, rinnovi, commissioni e abbonamenti; un badge se la pratica esiste già.
- Modifica di un movimento: «Contesta questo addebito», che apre una pratica legata a quel movimento. È anche l'ingresso per chi inserisce a mano.
- Dashboard: «Recuperati: X €» accanto al contatore di Soldi ritrovati.
- `lib/data/digest.ts` e `lib/reports/digest.ts`: sezione «Pratiche» con le scadenze entro 14 giorni e le risposte scadute.
- `app/api/account/export/route.ts`: le pratiche entrano nell'export GDPR. Alla cancellazione ci pensa già il cascade sullo spazio.
- `lib/billing/plan.ts`: una riga in `PRO_FEATURES`.
- `app/(legal)/privacy/page.tsx`: descrivere il nuovo trattamento (lettere salvate, nessun nuovo fornitore nell'MVP).
- Seed demo: una pratica vinta (palestra, 49 €), un rimborso SDD in bozza con 12 giorni di tempo, un reclamo inviato in attesa di risposta.

### Test (Vitest)

**`lib/finance/claims.test.ts`**
- `refundDeadline`: addebito del 2026-01-05 → 2026-03-02; nell'anno bisestile, 2028-01-05 → 2028-03-01.
- `italianHolidays`: il 2027 contiene 2027-03-29 (Pasquetta) e 2027-10-04 (San Francesco, di lunedì); il 2026 contiene 2026-04-06.
- `addBusinessDays`: un reclamo inviato lunedì 2026-12-21 con 15 giornate operative scade il 2027-01-18. Salta 24, 25 e 31 dicembre, 1° e 6 gennaio e i fine settimana.
- `answerDeadline`: servizi di pagamento contro altri servizi bancari.
- `chargesAfterCancellation`: segnala «PALESTRA FITLIFE SDD» del 1° novembre con disdetta efficace dal 31 ottobre; ignora l'addebito precedente, quello già contestato e un esercente diverso.
- `looksLikeDirectDebit`: vero per «ADDEBITO DIRETTO SDD ENEL ENERGIA» e «RID FASTWEB», falso per «PAGAMENTO POS NETFLIX».
- `nextStep`: reclamo inviato e scaduto → suggerisce l'ABF; rimborso in bozza a 3 giorni dalla scadenza → urgente.
- `summarizeClaims`: una pratica vinta da 49 € e una disdetta vinta da 120 €/anno danno «recuperati 49», «risparmio annuo 120»; quelle perse non contano.

**`lib/claims/letters.test.ts`**
- Ogni modello contiene nome, importo «49,00 €», data in italiano e segnaposto, e mai `undefined` o `NaN`.
- Senza nome usa «[Nome e cognome]», come fa già la lettera di disdetta.

**`lib/validations/claims.test.ts`**
- Esito `WON` senza importo → errore; data di invio futura → errore; disdetta senza data di efficacia → errore.

**`app/(dashboard)/ritrovati/pratiche/actions.test.ts`**, con Prisma simulato come in `app/api/billing/webhook/route.test.ts`:
- Una pratica di un altro spazio → «Pratica non trovata».
- Il piano Free con una pratica già aperta → rifiutato; Pro → consentito.

**`lib/finance/found-money.test.ts`** (esistente): `Duplicate` espone `transactionId`.

### Piano giorno per giorno (MVP)

| Giorno | Cosa |
| --- | --- |
| 1 | Schema e migrazione sicura; `lib/finance/claims.ts` con i test |
| 2 | Lettere, validazione, `lib/data/claims.ts`, azioni server, con i test |
| 3 | Pagine `/ritrovati/pratiche` e dettaglio, componenti |
| 4 | Collegamenti: Soldi ritrovati, movimento, dashboard, digest, export GDPR, `plan.ts`, seed |
| 5 | Rilettura dei testi, prova su telefono e in tema scuro, pagina privacy, deploy, query di monitoraggio |

### Come capiamo se funziona

Senza script di tracciamento, perché la privacy è parte del prodotto: basta la tabella `claims`.

```sql
select kind, status, count(*), sum(recovered_amount) as recuperati
from claims group by kind, status order by kind, status;
```

Soglie per decidere dopo 4 settimane (da tarare sui primi dati):
- almeno il 25% di chi apre Soldi ritrovati apre una pratica;
- almeno il 60% delle pratiche aperte viene segnata come inviata;
- almeno il 30% delle inviate si chiude vinta, anche parzialmente;
- passaggi a Pro partiti dalla pagina delle pratiche: confrontare il tasso con quello degli altri punti d'ingresso.

Se la seconda soglia non viene raggiunta, il problema è l'attrito dell'invio, e la fase 2 (invio diretto) diventa la priorità. Se manca la terza, i modelli di lettera vanno rivisti con un legale.

### Fase 2 (2–3 settimane, dopo la validazione)

- **Invio diretto** di PEC o raccomandata tramite un fornitore via API: mandato esplicito a ogni invio con un clic di conferma, ricevuta di consegna salvata (utile davanti all'ABF), accordo con il fornitore come responsabile del trattamento.
- **Storico della pratica** (tabella `ClaimEvent`): ogni passaggio con la data, da usare come prova.
- **Promemoria giornalieri** per le scadenze imminenti.
- **Nuovi tipi:** recesso per modifica unilaterale (art. 118 TUB per i conti, Codice delle comunicazioni elettroniche per la telefonia), rimborso dei pedaggi (rimando all'app nazionale), ritardi dei treni (Reg. UE 2021/782), voli (Reg. CE 261/2004), ricorso all'ABF guidato.
- **AI che legge la risposta:** l'utente incolla la risposta dell'azienda, l'AI la classifica (accolta, respinta, da sollecitare) e propone il passo successivo. Con il consenso all'AI già esistente (`aiConsentAt`) e l'indicazione chiara che è un testo generato (AI Act, art. 50).
- **Contatore pubblico** sulla landing («gli utenti FinTrack hanno recuperato X €»): solo totali aggregati, nessun dato personale.

### Rischi specifici e contromisure

| Rischio | Contromisura |
| --- | --- |
| Una lettera sbagliata danneggia l'utente | Testi rivisti da un legale, norme citate, bozza sempre modificabile, «modello informativo, non consulenza legale» |
| Dati personali nelle lettere | Segnaposto per IBAN e numeri di contratto, export e cancellazione GDPR, nessun nuovo fornitore nell'MVP |
| Pochi dati con l'inserimento manuale | Pratica apribile da qualunque movimento; suggerimenti più ricchi per chi importa i CSV |
| Il lavoro si allarga troppo | Solo tre tipi nell'MVP; tutti gli altri in fase 2 |
| Effetto "promessa mancata" | Il contatore mostra solo i soldi che l'utente dichiara di aver recuperato, mai stime |

---

## Fonti

**Normativa e regolazione**
- PSD3/PSR: [Taylor Wessing, accordo del 27/11/2025](https://www.taylorwessing.com/en/insights-and-events/insights/2025/11/eu-lawmakers-strike-a-deal-on-payments-reforms) · [Worldline, perimetro e tempi](https://worldline.com/en/home/main-navigation/resources/blogs/2026/the-scope-and-timeline-are-locked-in-for-psd3-and-psr-what-should-psps-know)
- FIDA: [KPMG, introduzione 2026](https://kpmg.com/cy/en/home/insights/2026/02/introduction-to-fida-understanding-the-financial-data-access-regulation.html) · [Open Banking Tracker](https://openbankingtracker.com/regulation/fida)
- Euro digitale: [Banca d'Italia](https://www.bancaditalia.it/media/notizia/il-progetto-euro-digitale-passa-alla-nuova-fase/) · [QuiFinanza](https://quifinanza.it/economia/euro-digitale-quando-entra-vigore-emissione-bce/992115/)
- AI Act art. 50: [Fiscal Focus](https://www.fiscal-focus.it/news-24/ore-17-43-ai-act-obblighi-di-trasparenza-operativi-per-chatbot-e-contenuti-generati-dall-ia,3,187282) · [Money.it](https://www.money.it/ai-act-cosa-cambia-2-agosto-imprese-usano-intelligenza-artificiale)
- Pulsante di recesso: [iubenda](https://www.iubenda.com/it/blog/funzione-di-recesso-online-direttiva-2023-2673/) · [Agenda Digitale](https://www.agendadigitale.eu/cultura-digitale/ecommerce-scatta-lobbligo-del-pulsante-di-recesso-come-adeguarsi/)
- Rimborso dei pedaggi: [QuiFinanza](https://quifinanza.it/info-utili/pedaggi-autostradali-rimborsi-1-giugno-2026/994084/) · [Il Post](https://www.ilpost.it/2025/12/07/rimborsi-autostrada-2026/)
- Rimborso degli addebiti diretti SEPA: [BlueRating](https://www.bluerating.com/?p=6304) · [Centro Tutela Consumatori Bolzano](https://www.consumer.bz.it/it/print/pdf/node/16136)
- Legge di bilancio 2026, famiglie e ISEE: [Informazione Fiscale](https://www.informazionefiscale.it/legge-di-bilancio-2026-famiglia-bonus-isee-novita) · [730/2026, QuiFinanza](https://quifinanza.it/fisco-tasse/modello-730-2026-scadenza-novita/956358/)
- Fringe benefit 2026: [Sky TG24](https://tg24.sky.it/economia/2026/01/14/fringe-benefit-2026-bonus-dipendenti-esentasse) · [Centro Fiscale](https://centrofiscale.com/fringe-benefit-2026-regole-novita/)
- TFR in silenzio-assenso: [Informazione Fiscale](https://www.informazionefiscale.it/TFR-silenzio-assenso-fondo-pensione-novita-legge-bilancio-2026)
- Cripto 2026: [Money.it](https://www.money.it/tassazione-criptovalute-come-funziona-aliquote-calcoli) · [Milano Finanza](https://www.milanofinanza.it/news/tasse-e-crypto-la-stagione-del-730-arriva-il-primo-exchange-italiano-che-paga-le-imposte-per-te-202605220957077101)
- Fatture elettroniche consultabili dai consumatori: [Agenzia delle Entrate](https://www.agenziaentrate.gov.it/portale/documents/20143/3025163/doc_20200304_volantino_consultazione_fatture.pdf/63bbb3a9-658f-27ab-755f-8a3feec3a3a2)
- IT-Wallet e ISEE in App IO: [LentePubblica](https://lentepubblica.it/cittadini-e-imprese/it-wallet-cambia-da-settembre-2026-i-nuovi-documenti-in-arrivo-sullapp-io/)
- 4 ottobre festa nazionale: [Fiscal Focus](https://www.fiscal-focus.it/quotidiano/il-quotidiano/articoli-lavoro/istituita-la-festa-nazionale-di-san-francesco-d-assisi-il-4-ottobre-diventa-giorno-festivo-dal-2026,3,178265)

**Mercato, prezzi e comportamenti**
- Costo dei conti correnti: [Banca d'Italia, indagine 2025](https://www.bancaditalia.it/pubblicazioni/indagine-costo-cc/indagine-costo-cc2025/index.html) · [Finanza Digitale](https://www.finanzadigitale.com/news/costo-medio-conto-corrente-banca-italia/)
- RC auto per provincia (IVASS IPER): [Teleborsa, settembre 2026](https://www.teleborsa.it/DettaglioNews/239_2026-09-24_TLB/RC-Auto-prezzo-medio-scende-a-422-euro-le-province-che-pagano-di-pi.html)
- Energia e Portale Offerte: [QualEnergia](https://www.qualenergia.it/articoli/arera-mercato-libero-retail-avanza-pochi-conoscono-bene/) · [ARERA](https://www.arera.it/consumatori/il-portale-offerte)
- Spese impreviste e fondo emergenza: [Money.it](https://www.money.it/Cos-e-un-fondo-di-emergenza-e)
- Conti dormienti: [Panorama](https://www.panorama.it/attualita/economia/depositi-bancari) · [InvestireOggi](https://www.investireoggi.it/depositi-dormienti-cosa-recuperarli/)
- Coppie e soldi: [SosTariffe, indagine Revolut](https://www.sostariffe.it/news/san-valentino-le-coppie-italiane-litigano-meno-per-i-soldi-lindagine-revolut-401129/) · [InvestireOggi](https://www.investireoggi.it/matrimonio-e-comunione-di-beni-addio-niente-conto-comune-con-il-partner-per-i-millenials/)
- Forfettari: [Informazione Fiscale, Osservatorio MEF](https://www.informazionefiscale.it/partite-iva-aperture-adesioni-regime-forfettario-osservatorio-mef) · [HYPE Business Tax Manager](https://www.partitaiva.it/hype-business-tax-manager)
- Costi dei fondi: [ESMA](https://www.esma.europa.eu/press-news/esma-news/new-investment-funds-drive-reduction-costs-investors)

**Concorrenti e tecnologia**
- Revolut AIR: [Revolut](https://www.revolut.com/news/revolut_enters_new_era_of_money_intelligence_with_launch_of_ai_assistant/) · [Meilleurtaux](https://banque.meilleurtaux.com/banque-en-ligne/actualites/2026-septembre/revolut-deploie-air-son-assistant-ia-en-europe.html)
- Satispay 2026: [BusinessOnline](https://www.businessonline.it/news/satispay-tutti-servizi-costi-relativi-lista-aggiornata-dopo-ha-aggiunto-3-carte-credito-investimenti-azioni-etf_n85638.html)
- YNAB, Monarch, Copilot e le lamentele: [Unstar](https://unstar.app/blog/ynab-vs-rocket-money-vs-monarch-budgeting-apps-ranked-2026) · [Finny](https://getfinny.app/blog/best-budget-apps-reddit-recommends-2026)
- Emma: [Trustpilot](https://it.trustpilot.com/review/emma-app.com)
- Rocket Money: [costo della negoziazione](https://help.rocketmoney.com/en/articles/9744474-bill-negotiation-charge)
- Pagamenti con agenti AI: [Mastercard](https://www.mastercard.com/news/europe/en/perspectives/en/2026/europe-is-building-the-foundations-for-trusted-agentic-commerce/) · [Payment Expert](https://paymentexpert.com/2026/03/02/agentic-payments-mastercard-santander/)
- Aggregatori open banking in Italia: [Open Banking Tracker](https://openbankingtracker.com/api-aggregators?country=IT) · [GoCardless non accetta nuove iscrizioni](https://dev.to/johnfrandsen/gocardless-bank-account-data-alternatives-what-to-use-when-signups-are-disabled-326d)

_Le norme citate nel piano (artt. 13–14 d.lgs. 11/2010, art. 118 TUB, termini del reclamo e dell'ABF, detrazioni per l'affitto) vanno verificate sul testo vigente da un legale prima del lancio: questo documento è ricerca, non parere legale._
