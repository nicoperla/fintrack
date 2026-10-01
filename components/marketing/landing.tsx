import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CloudOff,
  EyeOff,
  GalleryVerticalEnd,
  Handshake,
  Hourglass,
  Lock,
  Mic,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SiteFooter } from "@/components/marketing/site-footer";
import { cn } from "@/lib/utils";

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Zap,
    title: "Una spesa in tre secondi",
    text: "Scrivi «sigarette 6,20» o «35 benzina ieri»: importo, categoria, data e conto li capisce da solo.",
  },
  {
    icon: Mic,
    title: "Anche a voce",
    text: "Tocca il microfono e di' «ho speso 12 euro e 50 al bar». Fatto.",
  },
  {
    icon: Hourglass,
    title: "Il prezzo in ore di lavoro",
    text: "Quella cena da 60 € sono 4 ore e mezza del tuo lavoro. Cambia il modo di guardare le spese.",
  },
  {
    icon: CalendarClock,
    title: "I prossimi 45 giorni",
    text: "Vedi in anticipo dove va il saldo, con stipendio e bollette nei loro giorni. E l'avviso prima di andare in rosso.",
  },
  {
    icon: Sparkles,
    title: "Un coach che segue le tue regole",
    text: "50/30/20, prima paga te stesso, libertà finanziaria: scegli il metodo e cosa non vuoi tagliare. Il coach ragiona così.",
  },
  {
    icon: ShoppingBag,
    title: "Posso permettermelo?",
    text: "Scrivi «bici 890»: ti dice sì o no mentre scrivi, il giorno migliore per comprarla e quanto slittano i tuoi obiettivi.",
  },
  {
    icon: GalleryVerticalEnd,
    title: "Il tuo mese in storie",
    text: "A fine mese un recap a slide: la categoria protagonista, il posto del cuore, i giorni senza spese e il tuo profilo.",
  },
  {
    icon: Handshake,
    title: "Conti chiari in coppia",
    text: "Spazi condivisi con il partner: chi ha pagato cosa, chi deve quanto, a metà o in base agli stipendi.",
  },
  {
    icon: EyeOff,
    title: "Modalità discreta",
    text: "Un tocco e tutti gli importi spariscono: puoi aprire l'app anche sul treno.",
  },
  {
    icon: CloudOff,
    title: "Funziona offline",
    text: "Si installa come un'app e registra le spese anche senza rete: si sincronizzano appena torni online.",
  },
];

const FAQ = [
  {
    q: "Devo collegare il conto in banca?",
    a: "No. Registri le spese a parole, a voce o importando il CSV della banca. Nessun accesso ai tuoi conti, nessuna credenziale bancaria.",
  },
  {
    q: "Dove finiscono i miei dati?",
    a: "Su un database in Europa (Francoforte). Niente pubblicità e niente vendita di dati. Puoi scaricarli o cancellare l'account in qualsiasi momento dalle impostazioni.",
  },
  {
    q: "Il coach AI legge i miei movimenti?",
    a: "Solo se lo attivi tu: prima ti chiediamo il consenso e ti diciamo a quale fornitore va il riepilogo. Senza consenso il coach funziona lo stesso, con i calcoli fatti dall'app.",
  },
  {
    q: "Posso usarlo in coppia o in famiglia?",
    a: "Sì: inviti chi vuoi nel tuo spazio e vedete gli stessi conti, budget e obiettivi. Conti chiari vi dice chi deve quanto a chi.",
  },
];

/** A static glimpse of the app for the hero: quick entry, a forecast and the coach. */
function HeroMockup() {
  const points = [62, 58, 55, 52, 49, 45, 42, 40, 78, 74, 70, 67, 63, 60];
  const path = points
    .map((y, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * 280},${100 - y}`)
    .join(" ");
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden>
      <div
        className="absolute -inset-8 -z-10 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent 65%)" }}
      />
      <div className="bg-card grid gap-3 rounded-3xl border p-4 shadow-2xl">
        <div className="bg-muted/60 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
          <Zap className="text-muted-foreground size-4" />
          <span>sigarette 6,20</span>
          <Mic className="text-muted-foreground ml-auto size-4" />
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full border px-2 py-0.5 font-medium">6,20 €</span>
          <span className="rounded-full border px-2 py-0.5">Tabacchi › Sigarette</span>
          <span className="flex items-center gap-1 rounded-full border px-2 py-0.5">
            <Hourglass className="size-3" /> 27 min di lavoro
          </span>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-muted-foreground text-xs">I prossimi 45 giorni</p>
          <svg viewBox="0 0 280 100" className="mt-1 h-20 w-full">
            <path d={`${path} L280,100 L0,100 Z`} fill="var(--viz-income)" opacity="0.12" />
            <path d={path} fill="none" stroke="var(--viz-income)" strokeWidth="2.5" />
          </svg>
          <p className="text-xs">
            Stipendio il <span className="font-medium">27</span>: il punto più basso è{" "}
            <span className="font-medium">412 €</span>.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <div className="relative size-12 shrink-0">
            <svg viewBox="0 0 36 36" className="size-12 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--muted)" strokeWidth="4" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="var(--delta-good)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${0.78 * 94} 94`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
              78
            </span>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground text-xs">Il tuo coach</p>
            <p className="font-medium">Metti da parte 350 € il 27, appena arriva lo stipendio.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing({
  priceLabel,
  deleted,
}: {
  /** "4,99 € al mese" from Stripe; null while payments aren't set up. */
  priceLabel: string | null;
  deleted: boolean;
}) {
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip">
      <header className="bg-background/80 supports-backdrop-filter:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" className="font-semibold tracking-tight">
            FinTrack
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <a
              href="#funzioni"
              className="text-muted-foreground hover:text-foreground hidden px-3 sm:block"
            >
              Funzioni
            </a>
            <a
              href="#prezzi"
              className="text-muted-foreground hover:text-foreground hidden px-3 sm:block"
            >
              Prezzi
            </a>
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Accedi
            </Link>
            <Link href="/register" className={buttonVariants({ size: "sm" })}>
              Inizia gratis
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {deleted && (
          <p className="bg-muted border-b px-4 py-3 text-center text-sm">
            Il tuo account è stato eliminato, insieme ai tuoi dati. Grazie per aver usato FinTrack.
          </p>
        )}

        <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div className="grid gap-6">
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Sparkles className="size-4" aria-hidden /> Finanze personali, senza fatica
            </p>
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
              I tuoi soldi,{" "}
              <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500 bg-clip-text text-transparent">
                finalmente chiari.
              </span>
            </h1>
            <p className="text-muted-foreground max-w-xl text-lg text-pretty">
              Registra una spesa in tre secondi, anche a voce. Scopri quanto ti costa in ore di
              lavoro, dove sta andando il saldo e se puoi permetterti quel weekend. Con un coach che
              ragiona come vuoi tu.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className={buttonVariants({ size: "lg", className: "h-11 px-5" })}
              >
                Inizia gratis
                <ArrowRight data-icon="inline-end" />
              </Link>
              <Link
                href="/login"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "h-11 px-5",
                })}
              >
                Ho già un account
              </Link>
            </div>
            <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5">
                <Check className="size-4" aria-hidden /> Gratis per sempre
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-4" aria-hidden /> Nessun collegamento alla banca
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-4" aria-hidden /> Dati in Europa
              </span>
            </p>
          </div>
          <HeroMockup />
        </section>

        <section id="funzioni" className="bg-muted/40 scroll-mt-14 border-y">
          <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-16 sm:py-20">
            <div className="grid max-w-2xl gap-3">
              <h2 className="text-3xl font-semibold tracking-tight">Non un altro foglio Excel.</h2>
              <p className="text-muted-foreground text-lg">
                FinTrack fa i conti al posto tuo e te li racconta in modo che restino in testa.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="bg-card grid content-start gap-2 rounded-2xl border p-5">
                  <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-muted-foreground text-sm">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="prezzi"
          className="mx-auto grid w-full max-w-5xl scroll-mt-14 gap-10 px-4 py-16 sm:py-20"
        >
          <div className="grid max-w-2xl gap-3">
            <h2 className="text-3xl font-semibold tracking-tight">
              Gratis. Pro se vuoi l&apos;AI.
            </h2>
            <p className="text-muted-foreground text-lg">
              Tutta l&apos;app è gratuita. Paghi solo se vuoi chiedere qualsiasi cosa al coach AI.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-card grid content-start gap-4 rounded-2xl border p-6">
              <div>
                <h3 className="text-lg font-semibold">Gratis</h3>
                <p className="text-3xl font-semibold tracking-tight">0 €</p>
              </div>
              <ul className="grid gap-2 text-sm">
                {[
                  "Movimenti, conti, budget, obiettivi e debiti illimitati",
                  "Inserimento rapido e a voce, import CSV",
                  "Previsione, ore di lavoro, analisi e report PDF",
                  "Coach con punteggio, consigli e «Posso permettermelo?»",
                  "Il mese in storie e conti chiari in coppia",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className={buttonVariants({ variant: "outline" })}>
                Crea un account
              </Link>
            </div>
            <div className="relative grid content-start gap-4 overflow-hidden rounded-2xl border-2 border-violet-500/60 p-6">
              <div
                aria-hidden
                className="absolute -top-20 -right-20 -z-10 size-56 rounded-full opacity-25 blur-3xl"
                style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
              />
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  Pro <Sparkles className="size-4 text-violet-500" aria-hidden />
                </h3>
                <p className="text-3xl font-semibold tracking-tight">
                  {priceLabel ?? "Presto disponibile"}
                </p>
              </div>
              <ul className="grid gap-2 text-sm">
                {[
                  "Tutto quello che c'è nel piano gratuito",
                  "Coach AI: chiedi qualsiasi cosa, risponde con i tuoi numeri",
                  "Piani su misura per il prossimo mese",
                  "Disdici quando vuoi, in due clic",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className={buttonVariants()}>
                Inizia gratis, passa a Pro quando vuoi
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-muted/40 border-y">
          <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1fr_1.4fr]">
            <div className="grid content-start gap-3">
              <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <h2 className="text-3xl font-semibold tracking-tight">I tuoi dati restano tuoi.</h2>
              <p className="text-muted-foreground">
                Database in Europa, niente pubblicità, niente vendita di dati. Scarichi tutto o
                cancelli l&apos;account con un clic. Leggi l&apos;
                <Link href="/privacy" className="text-foreground underline underline-offset-4">
                  informativa sulla privacy
                </Link>
                .
              </p>
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Lock className="size-4" aria-hidden /> Password cifrate, connessioni HTTPS.
              </p>
            </div>
            <dl className="grid gap-4">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="bg-card rounded-2xl border p-5">
                  <dt className="font-medium">{q}</dt>
                  <dd className="text-muted-foreground mt-1 text-sm">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl justify-items-center gap-5 px-4 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Inizia oggi. Tra un mese ti racconteremo com&apos;è andata.
          </h2>
          <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "h-11 px-6")}>
            Crea il tuo account gratis
            <ArrowRight data-icon="inline-end" />
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
