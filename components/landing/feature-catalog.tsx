"use client";

import { useState } from "react";
import {
  BadgeEuro,
  CalendarClock,
  Coffee,
  Coins,
  FileText,
  FolderHeart,
  Gauge,
  GalleryVerticalEnd,
  Gavel,
  HandCoins,
  Handshake,
  Hourglass,
  Landmark,
  LifeBuoy,
  Lightbulb,
  Mail,
  Mic,
  Radar,
  Repeat,
  RotateCcw,
  ScanSearch,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Reveal, SpotlightCard } from "@/components/landing/effects";
import { DISPLAY } from "@/components/landing/hero";
import { SectionTitle } from "@/components/landing/showcase";
import { cn } from "@/lib/utils";

type Feature = {
  icon: LucideIcon;
  name: string;
  text: string;
  /** What Pro adds to it, when it adds something. */
  pro?: string;
};

type Group = { id: string; label: string; title: string; text: string; features: Feature[] };

/** Every feature of the app, grouped by what it does for you. Keep in sync with the README. */
const GROUPS: Group[] = [
  {
    id: "ogni-giorno",
    label: "Ogni giorno",
    title: "Tenere i conti, senza fatica",
    text: "Registrare una spesa deve costare meno che dimenticarsela.",
    features: [
      {
        icon: Mic,
        name: "Inserimento rapido, anche a voce",
        text: "Scrivi «35 benzina ieri» o dillo al telefono: importo, categoria, data e conto li capisce da solo. Impara dalle tue descrizioni.",
      },
      {
        icon: Hourglass,
        name: "Il prezzo in ore di lavoro",
        text: "Accanto a ogni spesa, quanto tempo hai lavorato per pagarla. Le sigarette del mese diventano «4 ore di lavoro».",
      },
      {
        icon: Upload,
        name: "Import dalla banca",
        text: "Carichi il file CSV dell'estratto conto: colonne riconosciute, doppioni scartati, categorie assegnate imparando da te.",
      },
      {
        icon: Target,
        name: "Budget e obiettivi",
        text: "Un limite per categoria con l'avviso prima di sforare, e i salvadanai per le vacanze o il fondo emergenza.",
      },
      {
        icon: Landmark,
        name: "Piano debiti",
        text: "Prestiti e carte revolving: l'ordine giusto per chiuderli, la data di fine e gli interessi risparmiati.",
      },
      {
        icon: TrendingUp,
        name: "Investimenti a parte",
        text: "ETF, fondi e fondo pensione separati dai soldi da spendere: quanto hai versato, quanto vale, quanto rende.",
      },
      {
        icon: Coins,
        name: "30 valute, offline e modalità discreta",
        text: "Conti in dollari col cambio BCE, spese registrate anche senza rete, importi nascosti con un tocco quando sei in treno.",
      },
      {
        icon: FileText,
        name: "Report PDF",
        text: "Il mese o l'anno in un documento: entrate, uscite, categorie e saldi, da stampare o archiviare.",
      },
    ],
  },
  {
    id: "quanto-spendere",
    label: "Quanto posso spendere",
    title: "Sapere oggi come va a finire",
    text: "Il saldo del conto non dice la verità: queste funzioni sì.",
    features: [
      {
        icon: BadgeEuro,
        name: "Lo stipendio vero",
        text: "Un numero solo: quanto puoi spendere fino al prossimo stipendio, con IMU, bollo, assicurazione e regali di Natale già messi da parte un po' alla volta.",
      },
      {
        icon: CalendarClock,
        name: "I prossimi 45 giorni",
        text: "Il saldo previsto giorno per giorno, con stipendio e bollette nei loro giorni. Ti avvisa prima di andare in rosso, non dopo.",
      },
      {
        icon: ShoppingBag,
        name: "Posso permettermelo?",
        text: "Scrivi «weekend a Roma 350» e ricevi il verdetto: lo copri con il mese, devi pescare dai risparmi, o è meglio aspettare.",
      },
      {
        icon: LifeBuoy,
        name: "Il crash test",
        text: "E se perdessi il lavoro? Simula la NASpI con le regole INPS, una spesa imprevista o il mutuo che sale, e ti dice quanti mesi reggi.",
      },
    ],
  },
  {
    id: "ritrova",
    label: "Ritrova i soldi",
    title: "I soldi che stai perdendo, trovati e ripresi",
    text: "È qui che FinTrack si ripaga.",
    features: [
      {
        icon: HandCoins,
        name: "Soldi ritrovati",
        text: "Un contatore di quello che puoi recuperare: il rimborso del 730, i doppi addebiti, gli abbonamenti aumentati o dimenticati, le commissioni della banca.",
        pro: "Con Pro vedi quali, una per una, e scarichi il dossier 730 e le lettere di disdetta.",
      },
      {
        icon: RotateCcw,
        name: "Riprenditeli",
        text: "Dalla scoperta al rimborso: la lettera con le leggi giuste (disdetta, rimborso SEPA entro 8 settimane, reclamo alla banca), le scadenze di risposta e il passo successivo, fino all'Arbitro Bancario Finanziario.",
        pro: "Gratis una pratica alla volta; con Pro tutte quelle che vuoi, con le lettere in PDF per la raccomandata.",
      },
      {
        icon: Radar,
        name: "Radar dei diritti",
        text: "Il 730 precompilato confrontato con le spese che hai fatto: cosa manca, la detrazione per l'affitto, il credito welfare che sta per scadere.",
      },
      {
        icon: Gauge,
        name: "Il Tariffometro",
        text: "RC auto, conto corrente e bolletta della luce confrontati con le medie pubbliche di IVASS, Banca d'Italia e ARERA, e cosa fare per pagare meno.",
      },
      {
        icon: ScanSearch,
        name: "Radiografia dei costi",
        text: "I costi scritti nel KID di fondi e polizze, trasformati in euro: quanto ti costano in 10, 20 e 30 anni, accanto alla media della categoria.",
      },
      {
        icon: Repeat,
        name: "Abbonamenti e ricorrenti",
        text: "Riconosciuti da soli dai movimenti, con il costo all'anno, i prossimi addebiti e gli aumenti di prezzo appena arrivano.",
      },
    ],
  },
  {
    id: "abitudini",
    label: "Abitudini",
    title: "Spendere meglio, senza prediche",
    text: "Le regole le decidi tu; FinTrack ti aiuta a rispettarle.",
    features: [
      {
        icon: Sparkles,
        name: "Il coach",
        text: "Scegli il metodo (50/30/20, prima paga te stesso…), le priorità e cosa non vuoi tagliare: punteggio di salute, piano e consigli concreti con i tuoi numeri.",
        pro: "Con Pro chiedi qualsiasi cosa al coach AI, che risponde con i tuoi dati: fino a 30 domande al giorno.",
      },
      {
        icon: Gavel,
        name: "Il patto",
        text: "Scommetti contro te stesso: un limite di spesa per il mese, una promessa o una multa nel tuo salvadanaio e un amico che fa da arbitro con un link.",
      },
      {
        icon: Lightbulb,
        name: "Analisi",
        text: "Dove vanno davvero i soldi: le categorie che crescono, le piccole spese che si sommano, il flusso del mese.",
      },
      {
        icon: GalleryVerticalEnd,
        name: "Il mese in storie",
        text: "A fine mese un recap a slide, come le storie di Instagram, con un'immagine da condividere senza importi.",
      },
      {
        icon: Trophy,
        name: "Traguardi",
        text: "Streak dei giorni in cui registri, badge e livelli: tenere i conti diventa un'abitudine.",
      },
    ],
  },
  {
    id: "insieme",
    label: "In coppia e in famiglia",
    title: "Il nostro, il mio e il tuo",
    text: "Uno spazio condiviso con chi vive con te, senza rinunciare al tuo.",
    features: [
      {
        icon: Handshake,
        name: "Conti chiari",
        text: "Chi ha pagato cosa per le spese comuni e chi deve quanto a chi, a metà o in proporzione agli stipendi.",
      },
      {
        icon: Coffee,
        name: "Il caffè dei conti",
        text: "Una volta al mese, un quarto d'ora insieme con l'agenda già scritta: com'è andato il mese, chi ha messo cosa, gli obiettivi, una decisione da prendere.",
      },
      {
        icon: UsersRound,
        name: "Mio, tuo, nostro",
        text: "Il conto comune lo vedete tutti; del tuo spazio personale l'altro vede solo i totali che scegli tu.",
      },
      {
        icon: FolderHeart,
        name: "Il fascicolo di famiglia",
        text: "La mappa di conti, investimenti, debiti e documenti, per chi deve saperlo se a te succede qualcosa.",
        pro: "Con Pro lo scarichi in PDF e crei link a scadenza per una persona di fiducia.",
      },
      {
        icon: Mail,
        name: "Il riepilogo del lunedì",
        text: "Ogni settimana un'email con com'è andata, i budget a rischio, le scadenze in arrivo e i patti in corso.",
      },
    ],
  },
];

export const FEATURE_COUNT = GROUPS.reduce((n, g) => n + g.features.length, 0);

/** All the features, explained, one group at a time. */
export function FeatureCatalog() {
  const [active, setActive] = useState(GROUPS[0].id);

  return (
    <section id="funzioni" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
      <SectionTitle
        eyebrow="Tutte le funzioni"
        title={
          <>
            Un&apos;app sola, <span className="lp-gradient-text">tutto quello che serve.</span>
          </>
        }
        text="Scegli cosa ti interessa: ogni funzione spiegata in due righe, e dove serve Pro te lo diciamo."
      />
      <Reveal className="mt-12">
        <div
          role="tablist"
          aria-label="Gruppi di funzioni"
          className="mx-auto flex max-w-full [scrollbar-width:none] gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:justify-center"
        >
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              id={`tab-${g.id}`}
              aria-selected={active === g.id}
              aria-controls={`panel-${g.id}`}
              onClick={() => setActive(g.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active === g.id
                  ? "border-violet-400/50 bg-violet-500/15 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </Reveal>
      {GROUPS.map((g) => (
        // Every panel is in the page (for search engines and screen readers); one is shown.
        <div
          key={g.id}
          role="tabpanel"
          id={`panel-${g.id}`}
          aria-labelledby={`tab-${g.id}`}
          hidden={active !== g.id}
          className="mt-10"
        >
          <div className="mb-6 text-center">
            <h3 className={cn(DISPLAY, "text-2xl font-semibold text-white sm:text-3xl")}>
              {g.title}
            </h3>
            <p className="mt-1 text-white/55">{g.text}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.features.map((f) => (
              <SpotlightCard key={f.name} className="flex h-full flex-col gap-3 p-6">
                <span className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/30 to-cyan-500/10">
                  <f.icon className="size-5 text-white" aria-hidden />
                </span>
                <h4 className="text-lg font-semibold text-white">{f.name}</h4>
                <p className="text-sm text-pretty text-white/60">{f.text}</p>
                {f.pro && (
                  <p className="mt-auto flex gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.07] p-3 text-xs text-white/75">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-fuchsia-300" aria-hidden />
                    {f.pro}
                  </p>
                )}
              </SpotlightCard>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
