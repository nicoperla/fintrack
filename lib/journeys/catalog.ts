/*
 * "Percorsi": what to do with money and paperwork when life changes, step by step, with the
 * deadlines counted from the day of the event. The same idea as "Il mio 730", for the other big
 * moments. Orbitly informs: rules and deadlines are the usual ones, checked in October 2026; the
 * last word is the office's (INPS, Comune, Agenzia, ASL), and each step says which.
 */

export const JOURNEYS_CHECKED_AT = "ottobre 2026";

export type JourneyStep = {
  key: string;
  title: string;
  text: string;
  /** Days from the event: the deadline, or the advisable time when not `legal`. */
  dueDays?: number;
  /** A deadline set by law: missing it costs something. */
  legal?: boolean;
  documents?: string[];
  /** The office or site where it's done. */
  where?: string;
  /** The Orbitly tool that helps with it. */
  app?: { href: string; label: string };
};

export type Journey = {
  key: JourneyKey;
  title: string;
  /** The day everything is counted from, as asked in the form. */
  eventLabel: string;
  intro: string;
  steps: JourneyStep[];
};

export const JOURNEY_KEYS = ["lavoro", "figlio", "affitto", "casa", "lutto"] as const;
export type JourneyKey = (typeof JOURNEY_KEYS)[number];

export const JOURNEYS: Journey[] = [
  {
    key: "lavoro",
    title: "Ho perso il lavoro",
    eventLabel: "L'ultimo giorno di lavoro",
    intro:
      "La NASpI, il centro per l'impiego, l'ISEE che cambia e le spese da rivedere: cosa fare e in che ordine.",
    steps: [
      {
        key: "naspi",
        title: "Fai la domanda di NASpI",
        text: "Spetta se il lavoro è finito senza che fossi tu a volerlo (licenziamento, contratto scaduto, dimissioni per giusta causa) e hai almeno 13 settimane di contributi negli ultimi quattro anni. Chiesta entro 8 giorni parte dall'ottavo giorno; dopo, dal giorno dopo la domanda.",
        dueDays: 68,
        legal: true,
        documents: ["Lettera di licenziamento o fine contratto", "IBAN", "Ultime buste paga"],
        where: "INPS online con SPID o CIE, oppure un patronato (gratis)",
        app: { href: "/crash-test", label: "Quanto ti spetta e quanto reggi" },
      },
      {
        key: "impiego",
        title: "Il patto con il centro per l'impiego",
        text: "La domanda di NASpI vale anche come dichiarazione di disponibilità al lavoro. Poi il centro per l'impiego ti convoca per il patto di servizio: se non ti presenti, la NASpI si può sospendere.",
        where: "Centro per l'impiego della tua zona",
      },
      {
        key: "tfr",
        title: "Ultima busta paga e TFR",
        text: "Il datore di lavoro paga l'ultimo stipendio, le ferie non godute e il TFR, nei tempi del contratto. Se il TFR è in un fondo pensione, va chiesto al fondo. Conserva la CU che arriverà a marzo.",
        dueDays: 45,
        documents: ["Ultima busta paga", "CU dell'anno"],
      },
      {
        key: "isee",
        title: "L'ISEE corrente",
        text: "Se il reddito della famiglia cala di oltre il 25%, puoi chiedere l'ISEE corrente: bonus e Assegno unico si aggiornano subito, senza aspettare l'anno dopo.",
        where: "INPS o CAF",
        app: { href: "/isee", label: "ISEE e bonus" },
      },
      {
        key: "spese",
        title: "Rivedi le spese",
        text: "Metti in pausa gli abbonamenti che non servono e guarda per quanti mesi bastano i risparmi, con e senza la NASpI.",
        dueDays: 14,
        app: { href: "/recurring", label: "Abbonamenti" },
      },
      {
        key: "730",
        title: "Il 730 dell'anno dopo",
        text: "Senza un datore di lavoro a luglio, il rimborso arriva dall'Agenzia sul conto. Con più CU nello stesso anno il 730 può essere a debito: tienilo presente.",
        app: { href: "/730", label: "Il mio 730" },
      },
      {
        key: "anticipo",
        title: "Se vuoi metterti in proprio",
        text: "La NASpI si può chiedere tutta insieme, come anticipo, per avviare un'attività: la domanda va fatta entro 30 giorni dall'inizio dell'attività.",
        where: "INPS o patronato",
      },
    ],
  },
  {
    key: "figlio",
    title: "Nasce un figlio",
    eventLabel: "Il giorno della nascita (o dell'arrivo in famiglia)",
    intro:
      "Le pratiche dei primi giorni, i congedi, l'Assegno unico con gli arretrati, i bonus e cosa cambia nei conti di famiglia.",
    steps: [
      {
        key: "nascita",
        title: "La dichiarazione di nascita",
        text: "In ospedale entro 3 giorni, oppure al Comune entro 10. Il codice fiscale arriva da solo, la tessera sanitaria a casa.",
        dueDays: 10,
        legal: true,
        documents: ["Attestazione di nascita dell'ospedale", "Documenti dei genitori"],
        where: "Ospedale o Comune",
      },
      {
        key: "pediatra",
        title: "Scegli il pediatra",
        text: "Si sceglie all'ASL o online dal fascicolo sanitario della tua regione.",
        dueDays: 30,
        where: "ASL o fascicolo sanitario",
      },
      {
        key: "paternita",
        title: "Il congedo di paternità",
        text: "Il padre lavoratore dipendente ha 10 giorni di congedo obbligatorio, pagati al 100%, da usare tra i due mesi prima e i cinque mesi dopo la nascita.",
        dueDays: 150,
        legal: true,
        where: "Il datore di lavoro (e l'INPS)",
      },
      {
        key: "assegno",
        title: "L'Assegno unico",
        text: "Domanda all'INPS: se la fai entro 120 giorni dalla nascita, ricevi anche gli arretrati dal settimo mese di gravidanza. Se lo prendi già per altri figli, aggiungi il nuovo alla domanda.",
        dueDays: 120,
        legal: true,
        where: "INPS, patronato o app IO",
        app: { href: "/isee", label: "ISEE e bonus" },
      },
      {
        key: "nuovi-nati",
        title: "Il bonus nuovi nati (1.000 €)",
        text: "Per i nati dal 2025, con ISEE fino a 40.000 € (quello per le prestazioni familiari, dove la casa pesa meno).",
        dueDays: 120,
        legal: true,
        where: "INPS",
        app: { href: "/isee", label: "Stima il tuo ISEE" },
      },
      {
        key: "isee",
        title: "Aggiorna l'ISEE",
        text: "Con una persona in più la famiglia cambia: una DSU nuova abbassa l'ISEE e può aprire altri bonus.",
        dueDays: 60,
        where: "INPS o CAF",
        app: { href: "/isee", label: "ISEE e bonus" },
      },
      {
        key: "nido",
        title: "Asilo nido",
        text: "Il bonus nido rimborsa le rette fino a circa 3.600 € l'anno; le rette non rimborsate si detraggono nel 730, fino a 632 €.",
        app: { href: "/730", label: "Il mio 730" },
      },
      {
        key: "spazio",
        title: "Prepara i conti",
        text: "Una categoria per le spese del bambino e, se vuoi, un obiettivo di risparmio per lui.",
        app: { href: "/goals", label: "Obiettivi" },
      },
    ],
  },
  {
    key: "affitto",
    title: "Vado a vivere in affitto",
    eventLabel: "Il giorno in cui entri in casa",
    intro:
      "Il contratto giusto, la residenza, le utenze, la TARI e la detrazione che quasi nessuno chiede.",
    steps: [
      {
        key: "contratto",
        title: "Il contratto registrato",
        text: "Lo registra il proprietario entro 30 giorni dalla firma: chiedi la ricevuta. Controlla il tipo (4+4, 3+2 concordato, transitorio, per studenti) e il deposito, al massimo tre mensilità.",
        dueDays: 30,
        legal: true,
        documents: ["Contratto firmato", "Ricevuta della registrazione"],
      },
      {
        key: "residenza",
        title: "Il cambio di residenza",
        text: "Al Comune entro 20 giorni dal trasloco, anche online dal sito ANPR.",
        dueDays: 20,
        legal: true,
        where: "Comune o ANPR online",
      },
      {
        key: "utenze",
        title: "Luce, gas e internet",
        text: "Subentro o voltura: servono il codice POD della luce e il PDR del gas, dalle bollette o dal contatore. È anche il momento di scegliere l'offerta.",
        dueDays: 15,
        app: { href: "/ritrovati/tariffometro", label: "Il Tariffometro" },
      },
      {
        key: "tari",
        title: "La TARI",
        text: "La dichiarazione al Comune per la tassa sui rifiuti: di solito entro 90 giorni, ma ogni Comune ha le sue regole.",
        dueDays: 90,
        where: "Comune",
      },
      {
        key: "medico",
        title: "Il medico di base",
        text: "Se cambi ASL, scegli il nuovo medico.",
        where: "ASL o fascicolo sanitario",
      },
      {
        key: "detrazione",
        title: "La detrazione per l'affitto",
        text: "Tra i 20 e i 31 anni, con reddito fino a 15.493,71 €, il 20% del canone fino a 2.000 € l'anno; per gli altri inquilini con reddito basso 300 o 150 €. Nel precompilato di solito manca.",
        app: { href: "/ritrovati/radar", label: "Radar dei diritti" },
      },
      {
        key: "budget",
        title: "Le spese della casa nuova",
        text: "Affitto, bollette e TARI messi in conto prima che arrivino.",
        app: { href: "/stipendio-vero", label: "Stipendio vero" },
      },
    ],
  },
  {
    key: "casa",
    title: "Compro casa",
    eventLabel: "Il giorno del rogito",
    intro:
      "Le agevolazioni prima casa e le loro condizioni, cosa detrarre nel 730, IMU, utenze e i documenti da conservare.",
    steps: [
      {
        key: "prima-casa",
        title: "Le agevolazioni prima casa",
        text: "Imposta di registro al 2% (da privato) o IVA al 4% (da impresa): si chiedono nell'atto. In cambio: residenza nel Comune entro 18 mesi e non rivendere entro 5 anni, salvo ricomprare un'altra prima casa entro un anno.",
        dueDays: 0,
        legal: true,
        where: "Il notaio, nell'atto",
      },
      {
        key: "residenza",
        title: "La residenza nel Comune della casa",
        text: "Entro 18 mesi dal rogito, altrimenti le agevolazioni si perdono e si pagano le imposte piene con la sanzione.",
        dueDays: 540,
        legal: true,
        where: "Comune o ANPR online",
      },
      {
        key: "assicurazione",
        title: "L'assicurazione scoppio e incendio",
        text: "Di solito la chiede la banca per il mutuo: confronta i prezzi prima di accettare quella proposta dalla banca.",
        dueDays: 0,
      },
      {
        key: "utenze",
        title: "Utenze e TARI",
        text: "Voltura o subentro di luce e gas (codici POD e PDR), e la dichiarazione TARI al Comune, di solito entro 90 giorni.",
        dueDays: 90,
        where: "Fornitori e Comune",
      },
      {
        key: "730",
        title: "Nel 730 dell'anno dopo",
        text: "Gli interessi del mutuo prima casa si detraggono al 19% fino a 4.000 € (rigo E7), con le spese del notaio per il mutuo; il compenso dell'agenzia fino a 1.000 € (codice 17).",
        app: { href: "/730", label: "Il mio 730" },
      },
      {
        key: "imu",
        title: "IMU",
        text: "Sulla casa dove vivi non si paga, se non è di lusso. Sugli altri immobili: acconto a giugno e saldo a dicembre.",
        app: { href: "/stipendio-vero", label: "Stipendio vero" },
      },
      {
        key: "documenti",
        title: "Conserva i documenti",
        text: "Atto di acquisto, contratto di mutuo, certificazioni degli interessi e fatture: servono per il 730 e quando un giorno venderai.",
        app: { href: "/fascicolo", label: "Fascicolo di famiglia" },
      },
    ],
  },
  {
    key: "lutto",
    title: "Lutto in famiglia",
    eventLabel: "Il giorno del decesso",
    intro:
      "Le comunicazioni, i conti, la pensione di reversibilità, la successione e le spese da detrarre. Un passo alla volta.",
    steps: [
      {
        key: "comunicazioni",
        title: "Le prime comunicazioni",
        text: "Il Comune registra il decesso (di solito ci pensa l'agenzia funebre). Avvisa la banca, l'INPS se c'era una pensione, il datore di lavoro e le assicurazioni.",
        dueDays: 7,
        documents: ["Certificato di morte", "Documenti degli eredi"],
      },
      {
        key: "conti",
        title: "I conti in banca",
        text: "Quando lo sa, la banca blocca i conti: per sbloccarli servono la dichiarazione di successione (o l'esonero) e i documenti degli eredi.",
        where: "La banca",
      },
      {
        key: "reversibilita",
        title: "La pensione di reversibilità",
        text: "Al coniuge e ai figli a carico spetta una parte della pensione: domanda all'INPS.",
        dueDays: 60,
        where: "INPS o patronato",
      },
      {
        key: "successione",
        title: "La dichiarazione di successione",
        text: "Entro 12 mesi, online sul sito dell'Agenzia o con un CAF, un notaio o un professionista. Non serve se gli eredi sono coniuge e figli, ci sono solo conti fino a 100.000 € e nessun immobile.",
        dueDays: 365,
        legal: true,
        where: "Agenzia delle Entrate, CAF o notaio",
      },
      {
        key: "eredita",
        title: "Accettare o rinunciare",
        text: "L'eredità si può accettare anche con beneficio d'inventario, per non rispondere dei debiti, oppure rinunciare: dal notaio o in tribunale.",
        where: "Notaio o tribunale",
      },
      {
        key: "730",
        title: "Il 730 della persona scomparsa",
        text: "Gli eredi possono presentarlo per lei, anche precompilato: chiedi a un CAF. Le spese funebri si detraggono nel 730 di chi le ha pagate, fino a 1.550 €.",
        app: { href: "/730", label: "Il mio 730" },
      },
      {
        key: "utenze",
        title: "Utenze e abbonamenti",
        text: "Voltura a un erede o disdetta di luce, gas, telefono e abbonamenti.",
        app: { href: "/ritrovati/pratiche", label: "Lettere di disdetta" },
      },
    ],
  },
];

export const journeyByKey = (key: string) => JOURNEYS.find((j) => j.key === key) ?? null;
