import {
  ArrowLeftRight,
  BadgeEuro,
  Calculator,
  CalendarDays,
  ChartPie,
  CircleHelp,
  Coffee,
  EyeOff,
  FilePen,
  FileText,
  Flag,
  Flame,
  FolderHeart,
  GalleryVerticalEnd,
  Gauge,
  Gavel,
  HandCoins,
  Handshake,
  Landmark,
  LayoutGrid,
  LifeBuoy,
  Lightbulb,
  Map as MapIcon,
  PartyPopper,
  Radar,
  Repeat,
  ScanSearch,
  Settings,
  Sparkles,
  Tags,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  UsersRound,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

/*
 * The guided tour shown the first time someone opens the dashboard (components/tour/
 * product-tour.tsx). Each step lights up an element marked with data-tour="…"; the first
 * visible one of `targets` wins, so the same step works with the desktop menu and the phone's
 * bottom bar.
 */

export type TourStep = {
  id: string;
  chapter: string;
  icon: LucideIcon;
  title: string;
  body: string[];
  tips?: string[];
  /** data-tour values in order of preference; none: a card in the middle of the screen. */
  targets?: string[];
  /** Added when a later target was used, e.g. the "Altro" menu on phones. */
  fallbackNote?: string;
  /** Skipped when the element isn't on the page (a card that needs some data first). */
  optional?: boolean;
  /** The lit element can be used during the step, e.g. typing in the quick entry. */
  interactive?: boolean;
  kind?: "welcome" | "map" | "finale";
};

const ON_PHONE_MORE = "Sul telefono lo trovi nel menu «Altro», in basso a destra.";

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    kind: "welcome",
    chapter: "Benvenuto",
    icon: Sparkles,
    title: "Ti mostro Orbitly in due minuti",
    body: [
      "Facciamo un giro insieme: dove registrare le spese, come capire quanto puoi spendere davvero, e dove sono gli strumenti che ti fanno risparmiare.",
      "Vai avanti con i pulsanti o con le frecce della tastiera. Puoi uscire quando vuoi: la guida resta sempre disponibile dal pulsante «?» in alto.",
    ],
  },
  {
    id: "quick-entry",
    chapter: "Ogni giorno",
    icon: Zap,
    title: "Registra un movimento in tre secondi",
    body: [
      "Scrivi come parleresti: «12 pranzo oggi», «35 benzina ieri», «1500 stipendio». Orbitly capisce importo, categoria, data e conto, e ti mostra un'anteprima prima di salvare.",
    ],
    tips: [
      "Tocca il microfono per dettarlo a voce",
      "Dal computer: premi / da qualsiasi punto della dashboard per arrivare qui",
      "«contanti» o «carta» scelgono il conto, #vacanze aggiunge un'etichetta",
      "Più lo usi, più impara le tue descrizioni",
    ],
    targets: ["quick-entry"],
    interactive: true,
  },
  {
    id: "hero",
    chapter: "Ogni giorno",
    icon: Wallet,
    title: "Quanto hai, e quanto puoi spendere",
    body: [
      "Il numero grande è la somma dei conti da spendere: conto corrente, carte, contanti. Gli investimenti restano a parte, così non ti sembra di avere più liquidità di quella vera.",
      "Con «Lo stipendio vero» diventa ancora più onesto: ti dice quanto puoi spendere fino al prossimo stipendio, con IMU, bollo, assicurazione e regali già messi da parte un po' alla volta.",
    ],
    targets: ["hero"],
  },
  {
    id: "month",
    chapter: "Ogni giorno",
    icon: CalendarDays,
    title: "Il tuo mese a colpo d'occhio",
    body: [
      "Entrate, uscite e quanto hai messo da parte, confrontati con lo stesso periodo del mese scorso: in verde se va meglio, in rosso se va peggio.",
      "Sotto le uscite vedi anche quante ore di lavoro ti sono costate, se nelle impostazioni hai indicato il tuo stipendio.",
    ],
    targets: ["month-stats"],
  },
  {
    id: "forecast",
    chapter: "Ogni giorno",
    icon: TrendingUp,
    title: "I prossimi 45 giorni",
    body: [
      "Il saldo previsto giorno per giorno, con stipendio, bollette e abbonamenti nei loro giorni. Se stai per andare in rosso te lo dice prima, non dopo.",
    ],
    targets: ["forecast"],
    optional: true,
  },
  {
    id: "charts",
    chapter: "Capire",
    icon: ChartPie,
    title: "Dove vanno i soldi",
    body: [
      "L'andamento degli ultimi sei mesi e le categorie del mese corrente: tocca una fetta per vedere i movimenti che la compongono.",
      "Quando c'è qualcosa da notare, come una categoria che cresce o tante piccole spese che si sommano, sopra compaiono gli insight del mese.",
    ],
    targets: ["charts"],
  },
  {
    id: "planning",
    chapter: "Pianificare",
    icon: Target,
    title: "Budget e obiettivi",
    body: [
      "I budget sono tetti di spesa per categoria: la barra si riempie man mano e ti avvisa prima di sforare.",
      "Gli obiettivi sono salvadanai per le vacanze, il fondo emergenza o la casa: Orbitly ti dice quanto mettere da parte ogni mese per arrivarci in tempo.",
    ],
    targets: ["planning"],
  },
  {
    id: "progress",
    chapter: "Abitudini",
    icon: Flame,
    title: "Serie e livelli",
    body: [
      "La fiammella conta i giorni di fila in cui registri almeno un movimento; il livello sale man mano che usi Orbitly.",
      "Toccala per vedere tutti i traguardi da sbloccare.",
    ],
    targets: ["progress"],
    optional: true,
  },
  {
    id: "nav-transactions",
    chapter: "Il menu",
    icon: ArrowLeftRight,
    title: "Transazioni",
    body: [
      "L'elenco di tutti i movimenti, con la ricerca e i filtri per data, conto, categoria, importo ed etichetta. Tocca un movimento per modificarlo.",
      "Da qui aggiungi anche un movimento con tutti i dettagli, o un giroconto tra due conti.",
    ],
    targets: ["nav-transactions"],
  },
  {
    id: "nav-accounts",
    chapter: "Il menu",
    icon: Landmark,
    title: "Conti",
    body: [
      "Conto corrente, carte, contanti, risparmi: ognuno con il suo saldo, anche in valuta estera con il cambio ufficiale della BCE.",
      "Il saldo di partenza lo scrivi una volta sola; da lì in poi lo aggiornano i movimenti.",
    ],
    targets: ["nav-accounts", "nav-more"],
    fallbackNote: ON_PHONE_MORE,
  },
  {
    id: "nav-budgets",
    chapter: "Il menu",
    icon: Target,
    title: "Budget",
    body: [
      "Un tetto mensile per una categoria, sottocategorie comprese: vedi quanto hai speso, quanto resta e il ritmo giusto per arrivare a fine mese.",
    ],
    targets: ["nav-budgets", "nav-more"],
    fallbackNote: ON_PHONE_MORE,
  },
  {
    id: "nav-goals",
    chapter: "Il menu",
    icon: Flag,
    title: "Obiettivi",
    body: [
      "Un obiettivo ha un importo e una data: aggiungi un versamento ogni volta che metti da parte qualcosa e guardalo riempirsi. Ti suggeriamo quanto versare al mese.",
    ],
    targets: ["nav-goals", "nav-more"],
    fallbackNote: ON_PHONE_MORE,
  },
  {
    id: "nav-coach",
    chapter: "Il menu",
    icon: Sparkles,
    title: "Il coach",
    body: [
      "Scegli il tuo metodo (50/30/20, prima paga te stesso, un budget per ogni cosa…), le priorità e le spese che non vuoi toccare. Il coach ti dà un punteggio di salute finanziaria, un piano e consigli concreti, con i tuoi numeri.",
      "Prova «Posso permettermelo?»: scrivi «weekend a Roma 350» e ricevi il verdetto.",
    ],
    tips: ["Con Orbitly Pro puoi anche fargli domande in chat"],
    targets: ["nav-coach", "nav-more"],
    fallbackNote: ON_PHONE_MORE,
  },
  {
    id: "nav-insights",
    chapter: "Il menu",
    icon: Lightbulb,
    title: "Analisi",
    body: [
      "Il flusso del mese, da dove entrano a dove escono i soldi; il calendario delle spese giorno per giorno; il patrimonio netto nel tempo.",
    ],
    targets: ["nav-insights", "nav-more"],
    fallbackNote: ON_PHONE_MORE,
  },
  {
    id: "nav-tools",
    chapter: "Il menu",
    icon: LayoutGrid,
    title: "Strumenti: qui c'è tutto il resto",
    body: [
      "Le funzioni speciali stanno qui: dallo stipendio vero al crash test, dai soldi ritrovati agli strumenti per la coppia. Nella prossima schermata te le mostro tutte, divise per obiettivo.",
    ],
    targets: ["nav-tools", "nav-more"],
    fallbackNote: "Sul telefono sono nel menu «Altro», in basso a destra.",
  },
  {
    id: "map",
    kind: "map",
    chapter: "Tutte le funzioni",
    icon: MapIcon,
    title: "La mappa di Orbitly",
    body: [
      "Tocca una funzione per aprirla: la guida si chiude e la ritrovi quando vuoi dal pulsante «?».",
    ],
  },
  {
    id: "space",
    chapter: "Il tuo account",
    icon: UsersRound,
    title: "In coppia o in famiglia",
    body: [
      "Puoi invitare chi vive con te in uno spazio condiviso, con conti, budget e obiettivi comuni. Il tuo spazio personale resta separato: dell'altro vedi solo quello che sceglie di mostrarti.",
      "Gli inviti si mandano da Impostazioni › Spazio. Quando hai più spazi, passi dall'uno all'altro da qui.",
    ],
    targets: ["space-switcher", "settings"],
  },
  {
    id: "privacy",
    chapter: "Il tuo account",
    icon: EyeOff,
    title: "Modalità discreta",
    body: [
      "Un tocco sull'occhio e tutti gli importi diventano puntini: comodo quando apri l'app in treno o in ufficio. Lo stesso tocco li fa ricomparire.",
    ],
    targets: ["privacy"],
  },
  {
    id: "settings",
    chapter: "Il tuo account",
    icon: Settings,
    title: "Impostazioni",
    body: [
      "Valuta, stipendio e ore di lavoro, il riepilogo del lunedì via email, l'abbonamento Pro. In Sicurezza attivi la verifica in due passaggi e vedi i dispositivi collegati; puoi anche scaricare tutti i tuoi dati.",
      "Il pulsante accanto, con il sole o la luna, passa dal tema chiaro a quello scuro.",
    ],
    targets: ["settings"],
  },
  {
    id: "help",
    chapter: "Il tuo account",
    icon: CircleHelp,
    title: "Rivedi la guida quando vuoi",
    body: ["Questo pulsante fa ripartire il tour da capo, da qualsiasi pagina."],
    targets: ["tour-button"],
  },
  {
    id: "finale",
    kind: "finale",
    chapter: "Fine",
    icon: PartyPopper,
    title: "Tutto pronto!",
    body: [
      "Il modo migliore per iniziare è registrare qualcosa oggi stesso, anche solo un caffè. Tra qualche giorno Orbitly avrà abbastanza dati per dirti cose che non sapevi sui tuoi soldi.",
    ],
  },
];

/** The chapters, in order, for the welcome card. */
export const TOUR_CHAPTERS = TOUR_STEPS.map((s) => s.chapter).filter(
  (chapter, i, all) => all.indexOf(chapter) === i && !["Benvenuto", "Fine"].includes(chapter),
);

export type MapFeature = { href: string; label: string; text: string; icon: LucideIcon };

/** Every tool, grouped by what it does for you: the "map" step of the tour. */
export const FEATURE_MAP: { title: string; features: MapFeature[] }[] = [
  {
    title: "Quanto puoi spendere",
    features: [
      {
        href: "/stipendio-vero",
        label: "Lo stipendio vero",
        icon: BadgeEuro,
        text: "Quanto puoi spendere fino al prossimo stipendio, con le spese grosse già da parte.",
      },
      {
        href: "/crash-test",
        label: "Il crash test",
        icon: LifeBuoy,
        text: "E se perdessi il lavoro? Quanti mesi reggi, con la NASpI calcolata.",
      },
      {
        href: "/simulator",
        label: "Simulatore",
        icon: Calculator,
        text: "Se metto da parte 200 € al mese, quanto avrò tra tre anni?",
      },
    ],
  },
  {
    title: "Ritrova i soldi",
    features: [
      {
        href: "/ritrovati",
        label: "Soldi ritrovati",
        icon: HandCoins,
        text: "Rimborso del 730, doppi addebiti, abbonamenti aumentati, commissioni.",
      },
      {
        href: "/ritrovati/pratiche",
        label: "Riprenditeli",
        icon: FilePen,
        text: "Le lettere per disdette, rimborsi e reclami, con le scadenze di risposta.",
      },
      {
        href: "/ritrovati/radar",
        label: "Radar dei diritti",
        icon: Radar,
        text: "Cosa manca nel 730 precompilato e il welfare aziendale in scadenza.",
      },
      {
        href: "/ritrovati/tariffometro",
        label: "Il Tariffometro",
        icon: Gauge,
        text: "RC auto, conto e luce confrontati con le medie ufficiali.",
      },
      {
        href: "/recurring",
        label: "Abbonamenti",
        icon: Repeat,
        text: "Riconosciuti da soli, con il costo all'anno e gli aumenti di prezzo.",
      },
    ],
  },
  {
    title: "Investire e pianificare",
    features: [
      {
        href: "/investments",
        label: "Investimenti",
        icon: TrendingUp,
        text: "Quanto hai versato, quanto vale, quanto rende: a parte dai soldi da spendere.",
      },
      {
        href: "/investments/costi",
        label: "Radiografia dei costi",
        icon: ScanSearch,
        text: "I costi di fondi e polizze trasformati in euro, in 10, 20 e 30 anni.",
      },
      {
        href: "/debts",
        label: "Piano debiti",
        icon: Landmark,
        text: "L'ordine giusto per chiudere prestiti e carte, e gli interessi risparmiati.",
      },
      {
        href: "/reports",
        label: "Report PDF",
        icon: FileText,
        text: "Il mese o l'anno in un documento da stampare o archiviare.",
      },
    ],
  },
  {
    title: "Insieme",
    features: [
      {
        href: "/insieme",
        label: "Mio, tuo, nostro",
        icon: UsersRound,
        text: "Il conto comune lo vedete tutti; del tuo l'altro vede solo i totali che scegli.",
      },
      {
        href: "/split",
        label: "Conti chiari",
        icon: Handshake,
        text: "Chi ha pagato cosa e chi deve quanto, a metà o in base agli stipendi.",
      },
      {
        href: "/caffe",
        label: "Il caffè dei conti",
        icon: Coffee,
        text: "Ogni mese l'agenda pronta per parlare di soldi in un quarto d'ora.",
      },
      {
        href: "/patto",
        label: "Il patto",
        icon: Gavel,
        text: "Un limite di spesa per il mese, con un amico che fa da arbitro.",
      },
      {
        href: "/fascicolo",
        label: "Fascicolo di famiglia",
        icon: FolderHeart,
        text: "La mappa di conti e documenti per chi deve saperlo se ti succede qualcosa.",
      },
    ],
  },
  {
    title: "Abitudini e strumenti",
    features: [
      {
        href: "/stories",
        label: "Il mese in storie",
        icon: GalleryVerticalEnd,
        text: "Il recap del mese a slide, con un'immagine da condividere senza importi.",
      },
      {
        href: "/achievements",
        label: "Traguardi",
        icon: Trophy,
        text: "Badge, livelli e la tua serie di giorni.",
      },
      {
        href: "/categories",
        label: "Categorie",
        icon: Tags,
        text: "Crea, rinomina e colora le tue categorie e sottocategorie.",
      },
      {
        href: "/transactions/import",
        label: "Importa CSV",
        icon: Upload,
        text: "Carica l'estratto conto della banca: doppioni scartati, categorie assegnate.",
      },
    ],
  },
];
