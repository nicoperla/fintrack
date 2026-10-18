# Il 730 guidato: piano in 3 fasi (ottobre 2026 – giugno 2027)

Il 730 di Orbitly è per la persona, non per il CAF. Chi lo usa ottiene un promemoria personale che lo guida passo dopo passo: cosa preparare, se può fare da solo, cosa portare al CAF, quando arrivano i soldi e cosa fare dopo. Orbitly informa, stima e ricorda. Non compila e non invia nulla, e i numeri del precompilato restano nel browser.

La data che non si sposta è l'uscita del precompilato, intorno al 30 aprile 2027. Le tre fasi seguono la stagione: ognuna è pronta prima del momento in cui serve.

## Fase 1 · «Il mio 730» tutto l'anno (pronta per novembre–dicembre 2026)

| #   | Cosa                                                                                                                                                                                                          | Dove                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1.1 | Regole per anno: IRPEF, detrazione per lavoro, familiari, tetti, codici dei righi, calendario della stagione, data di verifica e fonti                                                                        | `lib/tax/rules.ts`            |
| 1.2 | Sei tipi di spesa nuovi nel motore: università, spese funebri, affitto per studenti fuori sede, donazioni, previdenza complementare, colf e badanti (le ultime due sono deduzioni: rendono quanto l'aliquota) | `lib/finance/deductions.ts`   |
| 1.3 | «Chi sei»: 6 domande sull'anno (lavoro, datori di lavoro, casa, familiari a carico, altre entrate, cosa è successo)                                                                                           | tabella `tax_years`           |
| 1.4 | Il semaforo (da solo / da solo con modifiche / CAF) e «devo farlo?»                                                                                                                                           | `lib/tax/assessment.ts`       |
| 1.5 | I documenti da preparare, solo quelli che servono, con le spunte                                                                                                                                              | `lib/tax/documents.ts`        |
| 1.6 | La cartellina: ogni spesa detraibile con il suo documento e lo stato «ce l'ho»                                                                                                                                | `transactions.deduction_doc`  |
| 1.7 | Avvisi nel momento giusto: franchigia superata e tetto raggiunto quando registri la spesa; due stipendi, figlio vicino ai 4.000 € e fine anno in pagina e nel riepilogo                                       | `lib/tax/alerts.ts`           |
| 1.8 | La pagina `/730` con la timeline dell'anno e il prossimo passo; voce nel menu e nel tour                                                                                                                      | `app/(dashboard)/730`         |
| 1.9 | Il promemoria PDF «Il mio 730», che sostituisce il dossier                                                                                                                                                    | `lib/found-money/dossier.tsx` |

## Fase 2 · La stagione: preparazione e precompilato (pronta per gennaio–aprile 2027)

| #   | Cosa                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Simulazione dalla CU, anche con più CU: rimborso o debito stimato; la CU in PDF letta nel browser                                |
| 2.2 | Chi detrae cosa in coppia, solo se entrambe le persone lo attivano, senza mostrare importi dell'altra                            |
| 2.3 | Bonus casa in 10 rate: ristrutturazione, risparmio energetico, mobili; la rata dell'anno con il rigo dove trovarla               |
| 2.4 | Coach ISEE: scadenze, passi della DSU precompilata, soglie e cosa sbloccano; saldo al 31 dicembre e giacenza media di ogni conto |
| 2.5 | Lettore del PDF del precompilato nel browser, confronto riga per riga e «dove scriverlo», con il modulo a mano come riserva      |
| 2.6 | Il bivio: accetta così com'è, modifica, oppure vai al CAF                                                                        |

## Fase 3 · Invio, dopo e lancio (pronta per maggio–giugno 2027)

| #    | Cosa                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1  | Invio guidato: controlli prima di inviare da soli (sostituto, IBAN, 8, 5 e 2 per mille), lista per il CAF, «Ho inviato» con data e canale        |
| 3.2  | Quando arrivano i soldi: il mese del rimborso, il rimborso nella previsione della dashboard, «è arrivato?» controllato sui movimenti             |
| 3.3  | Se sei a debito: la trattenuta di luglio e il secondo acconto di novembre nella previsione dei 45 giorni                                         |
| 3.4  | «Controlla il CAF»: il risultato del 730-3 contro la stima di Orbitly, nel browser                                                               |
| 3.5  | Errori dopo l'invio: la strada ancora aperta quel giorno (annullamento, integrativo, modello Redditi)                                            |
| 3.6  | Archivio: cosa conservare e fino a quando                                                                                                        |
| 3.7  | «Spiegami questa lettera»: foto di una lettera di Agenzia, INPS o Comune, spiegata in parole semplici con la scadenza; la foto non viene salvata |
| 3.8  | Trova bonus: catalogo nazionale con poche domande e i passi per chiederli                                                                        |
| 3.9  | Promemoria nelle date chiave del 730 nel riepilogo settimanale                                                                                   |
| 3.10 | Lancio: piani, landing, tour, README e informativa privacy aggiornati                                                                            |

## Stato (18 ottobre 2026)

Le tre fasi sono sviluppate e testate (tipi, lint, test automatici, build di produzione). Prima di andare online servono tre cose:

1. **La migrazione del database** `20261018120000_tax_years` (una tabella nuova e una colonna, nessun dato toccato), da applicare con `prisma migrate deploy` **prima** del push: il codice nuovo legge la colonna `transactions.deduction_doc`.
2. **Un PDF vero del precompilato** per mettere a punto il lettore (la lettura oggi è «in prova» e si può sempre correggere a mano). Resta sul computer; nel progetto entra solo una copia con dati inventati.
3. **Le date del 730/2027** da confermare quando l'Agenzia le pubblica (aprile 2027): sono in `lib/tax/rules.ts`, segnate come provvisorie.

## Dopo giugno 2027

- I «Percorsi» con lo stesso motore: lavoro perso (NASpI), un figlio, casa comprata, lutto in famiglia.
- Le regole 2027 (730/2028), con la legge di bilancio di fine 2026.

## Regole di sicurezza del progetto

- Il precompilato, il 730-3 e le spese sanitarie restano nel browser: non si salvano.
- Ogni regola ha la data di verifica e la fonte; nel dubbio, le stime sono prudenti («almeno»).
- Orbitly non trasmette dichiarazioni e non fa assistenza fiscale. Ogni prospetto dice «promemoria personale, non è un documento fiscale».
- Le funzioni che usano l'AI chiedono il consenso e dicono che il testo è generato dall'AI (AI Act, art. 50).
