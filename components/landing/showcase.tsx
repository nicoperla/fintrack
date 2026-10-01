"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image, { type StaticImageData } from "next/image";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Coins,
  Eye,
  EyeOff,
  FileText,
  GalleryVerticalEnd,
  Handshake,
  HandCoins,
  Hourglass,
  Landmark,
  LineChart,
  Mic,
  PiggyBank,
  Receipt,
  Repeat,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  Upload,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  BrowserFrame,
  PhoneFrame,
  SmartVideo,
  type SmartVideoHandle,
} from "@/components/landing/devices";
import {
  CountUp,
  Marquee,
  Reveal,
  SpotlightCard,
  Tilt,
  useSafeReducedMotion,
} from "@/components/landing/effects";
import { DISPLAY } from "@/components/landing/hero";
import { SHOTS, VIDEOS } from "@/components/landing/media";
import { cn } from "@/lib/utils";

export function SectionTitle({
  eyebrow,
  title,
  text,
  center = true,
}: {
  eyebrow: string;
  title: ReactNode;
  text?: ReactNode;
  center?: boolean;
}) {
  return (
    <Reveal
      className={cn("grid max-w-2xl gap-4", center && "mx-auto justify-items-center text-center")}
    >
      <p className="text-sm font-medium tracking-[0.2em] text-violet-300/80 uppercase">{eyebrow}</p>
      <h2
        className={cn(
          DISPLAY,
          "text-4xl leading-[1.08] font-semibold text-balance text-white sm:text-5xl",
        )}
      >
        {title}
      </h2>
      {text && <p className="text-lg text-pretty text-white/60">{text}</p>}
    </Reveal>
  );
}

const FEATURES: { icon: LucideIcon; label: string }[] = [
  { icon: Mic, label: "Inserimento a voce" },
  { icon: Hourglass, label: "Il prezzo in ore di lavoro" },
  { icon: CalendarClock, label: "Previsione a 45 giorni" },
  { icon: Sparkles, label: "Coach con le tue regole" },
  { icon: ShoppingBag, label: "Posso permettermelo?" },
  { icon: HandCoins, label: "Il 730 che si scrive da solo" },
  { icon: Receipt, label: "Doppi addebiti" },
  { icon: Repeat, label: "Abbonamenti e disdette" },
  { icon: GalleryVerticalEnd, label: "Il mese in storie" },
  { icon: Handshake, label: "Conti chiari in coppia" },
  { icon: EyeOff, label: "Modalità discreta" },
  { icon: CloudOff, label: "Funziona offline" },
  { icon: Coins, label: "30 valute" },
  { icon: FileText, label: "Report PDF" },
  { icon: Upload, label: "Import CSV" },
  { icon: Target, label: "Budget e obiettivi" },
  { icon: Landmark, label: "Piano debiti" },
  { icon: Trophy, label: "Traguardi" },
];

export function FeatureMarquee() {
  const pill = ({ icon: Icon, label }: (typeof FEATURES)[number]) => (
    <span
      key={label}
      className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm whitespace-nowrap text-white/75 backdrop-blur"
    >
      <Icon className="size-4 text-violet-300" aria-hidden />
      {label}
    </span>
  );
  return (
    <section aria-label="Tutte le funzioni" className="grid gap-4 py-6">
      <Marquee seconds={55}>{FEATURES.slice(0, 9).map(pill)}</Marquee>
      <Marquee seconds={60} reverse>
        {FEATURES.slice(9).map(pill)}
      </Marquee>
    </section>
  );
}

const NUMBERS = [
  { to: 3, suffix: " s", text: "per registrare una spesa, scrivendola o dicendola" },
  {
    to: 45,
    suffix: " giorni",
    text: "di saldo previsto, con stipendio e bollette nei loro giorni",
  },
  { to: 19, suffix: "%", text: "delle spese mediche che ti torna col 730, se le paghi con carta" },
  { to: 0, suffix: " €", text: "per iniziare. Senza collegare il conto in banca" },
];

export function Numbers() {
  return (
    <section className="mx-auto grid max-w-6xl gap-4 px-4 py-20 sm:grid-cols-2 lg:grid-cols-4">
      {NUMBERS.map((n, i) => (
        <Reveal key={n.text} delay={i * 0.08}>
          <SpotlightCard className="h-full p-6">
            <p className={cn(DISPLAY, "lp-gradient-text text-5xl font-semibold")}>
              <CountUp to={n.to} />
              {n.suffix}
            </p>
            <p className="mt-3 text-white/60">{n.text}</p>
          </SpotlightCard>
        </Reveal>
      ))}
    </section>
  );
}

const STEPS: {
  icon: LucideIcon;
  title: string;
  text: string;
  image: StaticImageData;
  alt: string;
}[] = [
  {
    icon: Zap,
    title: "Scrivi o detta. Fatto.",
    text: "«sigarette 6,20», «35 benzina ieri», «ho speso 12 euro al bar»: importo, categoria, data e conto li capisce da solo. E ti dice quanto ti è costato in ore di lavoro.",
    image: SHOTS.mobileQuick,
    alt: "Inserimento rapido: «sigarette 6,20» riconosciuto come 6,20 € in Tabacchi, 27 minuti di lavoro",
  },
  {
    icon: CalendarClock,
    title: "Vedi il futuro del saldo.",
    text: "Patrimonio, entrate, uscite e la previsione dei prossimi 45 giorni, con stipendio e bollette nei loro giorni. Ti avvisa prima di andare in rosso.",
    image: SHOTS.mobileDashboard,
    alt: "La dashboard di FinTrack sul telefono con il patrimonio netto",
  },
  {
    icon: HandCoins,
    title: "Soldi ritrovati.",
    text: "Rimborsi del 730, doppi addebiti, abbonamenti aumentati e commissioni: un contatore dei soldi che puoi farti restituire o smettere di perdere.",
    image: SHOTS.mobileRitrovati,
    alt: "Soldi ritrovati: 221,85 € trovati, con il rimborso 730 stimato",
  },
  {
    icon: Sparkles,
    title: "Un coach con le tue regole.",
    text: "Scegli il metodo e cosa non vuoi tagliare. Punteggio, consigli concreti e la chat con l'AI rispondono con i tuoi numeri, nel tono che preferisci.",
    image: SHOTS.mobileCoach,
    alt: "Il coach con il punteggio di salute finanziaria",
  },
  {
    icon: GalleryVerticalEnd,
    title: "Il tuo mese, in storie.",
    text: "A fine mese un recap a slide: la categoria protagonista, il posto del cuore, i giorni senza spese. Da condividere senza mostrare gli importi.",
    image: SHOTS.mobileStories,
    alt: "Il mese in storie: il protagonista del mese è Casa",
  },
];

/** Scrollytelling: the phone stays put while the steps scroll by and change its screen. */
export function StoryScroll() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="funzioni" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
      <SectionTitle
        eyebrow="Dentro FinTrack"
        title={
          <>
            Cinque superpoteri, <span className="lp-gradient-text">in tasca.</span>
          </>
        }
        text="Non un altro foglio Excel: FinTrack fa i conti al posto tuo e te li racconta in modo che restino in testa."
      />
      <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:gap-20">
        <div className="grid gap-6 lg:gap-0">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                data-step={i}
                className="grid content-center gap-4 lg:min-h-[78vh]"
              >
                <Reveal>
                  <div
                    className={cn(
                      "grid gap-4 rounded-3xl border p-6 transition-all duration-700 lg:border-transparent lg:p-0",
                      active === i
                        ? "border-white/10 lg:opacity-100"
                        : "border-white/10 lg:opacity-30",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br transition-all duration-700",
                        active === i
                          ? "from-violet-500/40 to-cyan-500/20 shadow-[0_0_40px_-5px_rgba(167,139,250,0.7)]"
                          : "from-white/5 to-white/0",
                      )}
                    >
                      <Icon className="size-5 text-white" aria-hidden />
                    </span>
                    <p className="text-sm text-white/40">0{i + 1}</p>
                    <h3 className={cn(DISPLAY, "text-3xl font-semibold text-white sm:text-4xl")}>
                      {step.title}
                    </h3>
                    <p className="max-w-md text-lg text-white/60">{step.text}</p>
                    {/* Small screens: the screenshot right under the step. */}
                    <div className="mx-auto mt-2 w-56 lg:hidden">
                      <PhoneFrame>
                        <Image
                          src={step.image}
                          alt={step.alt}
                          sizes="224px"
                          className="h-full w-full object-cover"
                          placeholder="blur"
                        />
                      </PhoneFrame>
                    </div>
                  </div>
                </Reveal>
              </div>
            );
          })}
        </div>
        <div className="hidden lg:block">
          <div className="sticky top-[12vh] flex h-[76vh] items-center justify-center">
            <div
              aria-hidden
              className="absolute size-[520px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.35),transparent_65%)] blur-2xl"
            />
            <Tilt max={8} className="relative w-[300px]">
              <PhoneFrame>
                {STEPS.map((step, i) => (
                  <Image
                    key={step.title}
                    src={step.image}
                    alt={i === active ? step.alt : ""}
                    aria-hidden={i !== active}
                    sizes="300px"
                    placeholder="blur"
                    className={cn(
                      "absolute inset-0 h-full w-full object-cover transition-all duration-700",
                      i === active ? "scale-100 opacity-100" : "scale-[1.04] opacity-0",
                    )}
                  />
                ))}
              </PhoneFrame>
            </Tilt>
            <div className="absolute right-0 flex flex-col gap-2" aria-hidden>
              {STEPS.map((step, i) => (
                <span
                  key={step.title}
                  className={cn(
                    "w-1.5 rounded-full transition-all duration-500",
                    i === active
                      ? "h-8 bg-gradient-to-b from-violet-300 to-cyan-300"
                      : "h-1.5 bg-white/20",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function VideoShowcase() {
  const player = useRef<SmartVideoHandle>(null);
  const [time, setTime] = useState(0);
  const chapters = VIDEOS.desktop.chapters;
  const current = chapters.reduce((found, c, i) => (time >= c.at ? i : found), 0);
  return (
    <section id="video" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
      <SectionTitle
        eyebrow="Il video"
        title={
          <>
            Guardala <span className="lp-gradient-text">in azione.</span>
          </>
        }
        text={`${VIDEOS.desktop.seconds} secondi senza tagli: l'app vera, con i dati dell'account demo.`}
      />
      <Reveal className="relative mt-14">
        <div
          aria-hidden
          className="lp-motion absolute -inset-6 -z-10 rounded-[2.5rem] opacity-70 blur-3xl"
          style={{
            background: "conic-gradient(from 90deg, #6366f1, #d946ef, #22d3ee, #6366f1)",
            animation: "lp-orbit 18s linear infinite",
          }}
        />
        <Tilt max={3}>
          <BrowserFrame title="FinTrack · Dashboard">
            <div className="aspect-[1280/800]">
              <SmartVideo
                ref={player}
                src={VIDEOS.desktop.src}
                poster={VIDEOS.desktop.poster}
                label="Video dimostrativo di FinTrack: dashboard, inserimento rapido, Soldi ritrovati, coach e il mese in storie"
                onTime={setTime}
              />
            </div>
          </BrowserFrame>
        </Tilt>
      </Reveal>
      <Reveal delay={0.1}>
        <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {chapters.map((c, i) => (
            <li key={c.label}>
              <button
                type="button"
                onClick={() => player.current?.seek(c.at)}
                className={cn(
                  "relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                  i === current
                    ? "border-violet-400/40 bg-violet-500/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white",
                )}
              >
                <span className="font-mono text-xs text-white/40">
                  0:{String(Math.floor(c.at)).padStart(2, "0")}
                </span>
                {c.label}
                {i === current && (
                  <motion.span
                    layoutId="chapter-bar"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-violet-400 to-cyan-300"
                  />
                )}
              </button>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}

function Waveform() {
  return (
    <div aria-hidden className="flex h-10 items-center gap-1">
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="lp-motion w-1 origin-center rounded-full bg-gradient-to-t from-violet-400 to-cyan-300"
          style={{
            height: `${30 + ((i * 37) % 70)}%`,
            animation: `lp-wave ${0.8 + (i % 5) * 0.15}s ease-in-out ${i * 0.05}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function DiscreetDemo() {
  const reduce = useSafeReducedMotion();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setHidden((h) => !h), 1800);
    return () => clearInterval(id);
  }, [reduce]);
  return (
    <p
      aria-hidden
      className={cn(
        DISPLAY,
        "flex items-center gap-2 text-3xl font-semibold text-white tabular-nums",
      )}
    >
      {hidden ? (
        <EyeOff className="size-6 text-violet-300" />
      ) : (
        <Eye className="size-6 text-violet-300" />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={String(hidden)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {hidden ? "•••• €" : "8.934,58 €"}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}

function ShotCard({
  image,
  alt,
  className,
  position = "top",
}: {
  image: StaticImageData;
  alt: string;
  className?: string;
  position?: "top" | "center";
}) {
  return (
    <div
      className={cn(
        "relative mt-5 overflow-hidden rounded-t-2xl border border-b-0 border-white/10 [mask-image:linear-gradient(#000_65%,transparent)]",
        className,
      )}
    >
      <Image
        src={image}
        alt={alt}
        sizes="(min-width: 1024px) 560px, 100vw"
        placeholder="blur"
        className={cn(
          "w-full transition-transform duration-700 group-hover:scale-[1.03]",
          position === "top" ? "object-top" : "object-center",
        )}
      />
    </div>
  );
}

export function Bento() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <SectionTitle
        eyebrow="Tutto in un'app"
        title={
          <>
            Tutto quello che serve. <span className="lp-gradient-text">Niente di superfluo.</span>
          </>
        }
      />
      <div className="mt-14 grid auto-rows-auto gap-4 lg:grid-cols-6">
        <Reveal className="lg:col-span-4">
          <SpotlightCard className="h-full p-6 pb-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-medium text-emerald-300">
                  <HandCoins className="size-4" aria-hidden /> Soldi ritrovati
                </p>
                <h3 className={cn(DISPLAY, "mt-1 text-2xl font-semibold text-white")}>
                  Il contatore dei soldi da recuperare
                </h3>
              </div>
              <p className={cn(DISPLAY, "text-4xl font-semibold text-emerald-300 tabular-nums")}>
                <CountUp
                  to={221.85}
                  format={(n) => `${n.toFixed(2).replace(".", ",")} €`}
                  duration={2.2}
                />
              </p>
            </div>
            <ShotCard
              image={SHOTS.ritrovati}
              alt="Soldi ritrovati: rimborso 730, doppi addebiti e commissioni"
            />
          </SpotlightCard>
        </Reveal>
        <Reveal className="lg:col-span-2" delay={0.08}>
          <SpotlightCard className="flex h-full flex-col justify-between gap-6 p-6">
            <div>
              <p className="flex items-center gap-2 font-medium text-cyan-300">
                <Mic className="size-4" aria-hidden /> Dettatura
              </p>
              <h3 className={cn(DISPLAY, "mt-1 text-2xl font-semibold text-white")}>
                Parla, al resto pensa lei
              </h3>
              <p className="mt-2 text-white/55">
                «Ho speso 12 euro e 50 al bar»: diventa un movimento.
              </p>
            </div>
            <Waveform />
          </SpotlightCard>
        </Reveal>
        <Reveal className="lg:col-span-3" delay={0.05}>
          <SpotlightCard className="h-full p-6 pb-0">
            <p className="flex items-center gap-2 font-medium text-amber-300">
              <ShoppingBag className="size-4" aria-hidden /> Posso permettermelo?
            </p>
            <h3 className={cn(DISPLAY, "mt-1 text-2xl font-semibold text-white")}>
              Il verdetto mentre scrivi
            </h3>
            <ShotCard
              image={SHOTS.afford}
              alt="«weekend a Roma 350»: solo pescando dai risparmi, con il grafico del saldo"
            />
          </SpotlightCard>
        </Reveal>
        <Reveal className="lg:col-span-3" delay={0.1}>
          <SpotlightCard className="h-full p-6 pb-0">
            <p className="flex items-center gap-2 font-medium text-indigo-300">
              <LineChart className="size-4" aria-hidden /> I prossimi 45 giorni
            </p>
            <h3 className={cn(DISPLAY, "mt-1 text-2xl font-semibold text-white")}>
              Il saldo di domani, oggi
            </h3>
            <ShotCard image={SHOTS.forecast} alt="Previsione del saldo dei prossimi 45 giorni" />
          </SpotlightCard>
        </Reveal>
        <Reveal className="lg:col-span-2" delay={0.05}>
          <SpotlightCard className="flex h-full flex-col justify-between gap-6 p-6">
            <div>
              <p className="flex items-center gap-2 font-medium text-violet-300">
                <EyeOff className="size-4" aria-hidden /> Modalità discreta
              </p>
              <h3 className={cn(DISPLAY, "mt-1 text-2xl font-semibold text-white")}>
                Un tocco, importi spariti
              </h3>
              <p className="mt-2 text-white/55">Apri l&apos;app anche sul treno.</p>
            </div>
            <DiscreetDemo />
          </SpotlightCard>
        </Reveal>
        <Reveal className="lg:col-span-4" delay={0.1}>
          <SpotlightCard className="h-full p-6 pb-0">
            <p className="flex items-center gap-2 font-medium text-fuchsia-300">
              <Sparkles className="size-4" aria-hidden /> Coach
            </p>
            <h3 className={cn(DISPLAY, "mt-1 text-2xl font-semibold text-white")}>
              Punteggio, piano e consigli, con le tue regole
            </h3>
            <ShotCard image={SHOTS.coach} alt="Il coach: punteggio 52 su 100 e i consigli" />
          </SpotlightCard>
        </Reveal>
        <Reveal className="lg:col-span-3" delay={0.05}>
          <SpotlightCard className="h-full p-6 pb-0">
            <p className="flex items-center gap-2 font-medium text-pink-300">
              <Handshake className="size-4" aria-hidden /> Conti chiari in coppia
            </p>
            <h3 className={cn(DISPLAY, "mt-1 text-2xl font-semibold text-white")}>
              Chi deve quanto a chi
            </h3>
            <ShotCard
              image={SHOTS.split}
              alt="Conti chiari: chi ha pagato cosa e quanto deve ciascuno"
            />
          </SpotlightCard>
        </Reveal>
        <Reveal className="lg:col-span-3" delay={0.1}>
          <SpotlightCard className="h-full p-6 pb-0">
            <p className="flex items-center gap-2 font-medium text-sky-300">
              <Wallet className="size-4" aria-hidden /> Analisi
            </p>
            <h3 className={cn(DISPLAY, "mt-1 text-2xl font-semibold text-white")}>
              Dove vanno davvero i soldi
            </h3>
            <ShotCard image={SHOTS.insights} alt="Analisi: insight del mese e flusso dei soldi" />
          </SpotlightCard>
        </Reveal>
        <Reveal className="lg:col-span-6" delay={0.05}>
          <SpotlightCard className="grid gap-6 p-6 sm:grid-cols-3">
            {[
              {
                icon: CloudOff,
                title: "Funziona offline",
                text: "Si installa come un'app e registra anche senza rete.",
              },
              {
                icon: Coins,
                title: "30 valute",
                text: "Conti in dollari o franchi, totali in euro al cambio BCE.",
              },
              {
                icon: PiggyBank,
                title: "Budget, obiettivi e debiti",
                text: "Limiti per categoria, salvadanai e piano per uscire dai debiti.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <Icon className="size-5 text-violet-300" aria-hidden />
                </span>
                <div>
                  <p className="font-medium text-white">{title}</p>
                  <p className="text-sm text-white/55">{text}</p>
                </div>
              </div>
            ))}
          </SpotlightCard>
        </Reveal>
      </div>
    </section>
  );
}

const GALLERY: { image: StaticImageData; alt: string; mobile?: boolean }[] = [
  { image: SHOTS.dashboard, alt: "Dashboard, tema scuro" },
  { image: SHOTS.mobileQuick, alt: "Inserimento rapido sul telefono", mobile: true },
  { image: SHOTS.ritrovati, alt: "Soldi ritrovati" },
  { image: SHOTS.mobileStories, alt: "Il mese in storie", mobile: true },
  { image: SHOTS.coach, alt: "Il coach" },
  { image: SHOTS.mobileRitrovati, alt: "Soldi ritrovati sul telefono", mobile: true },
  { image: SHOTS.dashboardLight, alt: "Dashboard, tema chiaro" },
  { image: SHOTS.mobileCoach, alt: "Il coach sul telefono", mobile: true },
  { image: SHOTS.insights, alt: "Analisi" },
  { image: SHOTS.mobileDashboard, alt: "Dashboard sul telefono", mobile: true },
  { image: SHOTS.split, alt: "Conti chiari in coppia" },
];

function Lightbox({
  index,
  onClose,
  onMove,
}: {
  index: number | null;
  onClose: () => void;
  onMove: (delta: number) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (index === null) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove(1);
      if (e.key === "ArrowLeft") onMove(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, onClose, onMove]);

  return (
    <AnimatePresence>
      {index !== null && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={GALLERY[index].alt}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "relative max-h-[88vh]",
              GALLERY[index].mobile ? "w-auto" : "w-full max-w-5xl",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={GALLERY[index].image}
              alt={GALLERY[index].alt}
              sizes="100vw"
              className="max-h-[88vh] w-auto rounded-2xl border border-white/10 object-contain"
            />
            <p className="mt-3 text-center text-sm text-white/70">{GALLERY[index].alt}</p>
          </motion.div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Foto precedente"
            onClick={(e) => {
              e.stopPropagation();
              onMove(-1);
            }}
            className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            aria-label="Foto successiva"
            onClick={(e) => {
              e.stopPropagation();
              onMove(1);
            }}
            className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight className="size-6" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Gallery() {
  const [open, setOpen] = useState<number | null>(null);
  const move = useCallback(
    (delta: number) =>
      setOpen((i) => (i === null ? i : (i + delta + GALLERY.length) % GALLERY.length)),
    [],
  );
  const close = useCallback(() => setOpen(null), []);
  const item = (g: (typeof GALLERY)[number]) => {
    const index = GALLERY.indexOf(g);
    return (
      <button
        key={g.alt}
        type="button"
        onClick={() => setOpen(index)}
        aria-label={`Ingrandisci: ${g.alt}`}
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-transform duration-500 hover:-translate-y-1 hover:border-white/25",
          g.mobile ? "h-72 w-[133px]" : "h-72 w-[460px]",
        )}
      >
        <Image
          src={g.image}
          alt=""
          sizes={g.mobile ? "133px" : "460px"}
          className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
        />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pt-8 pb-2 text-left text-xs text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
          {g.alt}
        </span>
      </button>
    );
  };
  return (
    <section className="py-24">
      <div className="px-4">
        <SectionTitle
          eyebrow="Foto dall'app"
          title={
            <>
              Niente rendering. <span className="lp-gradient-text">Solo l&apos;app vera.</span>
            </>
          }
          text="Schermate dell'account demo, su computer e telefono, in tema scuro e chiaro. Tocca una foto per ingrandirla."
        />
      </div>
      <div className="mt-14 grid gap-4">
        <Marquee seconds={70}>{GALLERY.slice(0, 6).map(item)}</Marquee>
        <Marquee seconds={80} reverse>
          {GALLERY.slice(6).map(item)}
        </Marquee>
      </div>
      <Lightbox index={open} onClose={close} onMove={move} />
    </section>
  );
}
