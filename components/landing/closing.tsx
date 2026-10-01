"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronDown,
  FileText,
  HandCoins,
  Lock,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { CountUp, Reveal, SpotlightCard } from "@/components/landing/effects";
import { DISPLAY, Logo, PrimaryCta } from "@/components/landing/hero";
import { SectionTitle } from "@/components/landing/showcase";
import { useWarp } from "@/components/landing/starfield";
import { cn } from "@/lib/utils";

const RECEIPTS = [
  { name: "Visita dermatologica", detail: "Carta · 14 mar", amount: "120 €", ok: true },
  { name: "Ortodonzia", detail: "Bonifico · 2 mag", amount: "1.480 €", ok: true },
  { name: "Farmacia", detail: "Contanti · 9 giu", amount: "23,40 €", ok: true },
  { name: "Visita oculistica", detail: "Contanti · 21 set", amount: "90 €", ok: false },
];

export function Found730() {
  return (
    <section
      id="ritrovati"
      className="relative mx-auto grid max-w-6xl scroll-mt-24 items-center gap-14 px-4 py-24 lg:grid-cols-2"
    >
      <div className="grid gap-6">
        <SectionTitle
          center={false}
          eyebrow="Soldi ritrovati"
          title={
            <>
              Il 730 che <span className="lp-gradient-text">si scrive da solo.</span>
            </>
          }
          text="Farmacia, visite, dentista, veterinario, scuola e sport dei figli, abbonamento ai mezzi: mentre registri le spese, FinTrack mette da parte quelle detraibili e ti dice quanto ti torna. A maggio scarichi il dossier per il CAF."
        />
        <Reveal delay={0.1}>
          <ul className="grid gap-3 text-white/75">
            {[
              "Ti avvisa se paghi in contanti una spesa che deve essere tracciabile",
              "Trova i doppi addebiti, gli abbonamenti aumentati e quelli in scadenza",
              "Prepara la lettera di disdetta: la copi e la mandi",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                  <Check className="size-3.5 text-emerald-300" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal delay={0.05} className="relative">
        <div
          aria-hidden
          className="absolute -inset-8 -z-10 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.35),transparent_65%)] blur-2xl"
        />
        <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
          <div
            className="relative overflow-hidden rounded-2xl p-5 text-white"
            style={{ background: "linear-gradient(135deg, #047857, #0d9488 55%, #0369a1)" }}
          >
            <HandCoins aria-hidden className="absolute -right-4 -bottom-4 size-28 text-white/10" />
            <p className="text-sm text-white/80">Rimborso IRPEF stimato</p>
            <p className={cn(DISPLAY, "text-5xl font-semibold tabular-nums")}>
              <CountUp to={284} format={(n) => `${Math.round(n)} €`} duration={2.6} />
            </p>
            <p className="text-sm text-white/80">730/2027 · sale a ogni scontrino</p>
          </div>
          <ul className="grid gap-2">
            {RECEIPTS.map((row, i) => (
              <motion.li
                key={row.name}
                initial={{ opacity: 0, x: 40 }}
                // The cash row lands with a shake: it's the one that doesn't count.
                whileInView={
                  row.ok ? { opacity: 1, x: 0 } : { opacity: 1, x: [40, 0, -6, 6, -4, 0] }
                }
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  delay: 0.3 + i * 0.35,
                  duration: row.ok ? 0.6 : 0.9,
                  ease: "easeOut",
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
                  row.ok
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-amber-400/30 bg-amber-400/[0.06]",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    row.ok
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-amber-400/15 text-amber-300",
                  )}
                >
                  {row.ok ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <X className="size-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-white">{row.name}</span>
                  <span className={cn("text-xs", row.ok ? "text-white/45" : "text-amber-200/80")}>
                    {row.ok ? row.detail : `${row.detail} · in contanti non è detraibile`}
                  </span>
                </span>
                <span className="text-white/85 tabular-nums">{row.amount}</span>
              </motion.li>
            ))}
          </ul>
          <p className="flex items-center gap-2 px-1 text-xs text-white/50">
            <FileText className="size-3.5" aria-hidden /> Dossier 730 in PDF, pronto per il CAF
          </p>
        </div>
      </Reveal>
    </section>
  );
}

export function Pricing({ priceLabel }: { priceLabel: string | null }) {
  return (
    <section id="prezzi" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
      <SectionTitle
        eyebrow="Prezzi"
        title={
          <>
            Gratis. <span className="lp-gradient-text">Pro per recuperare di più.</span>
          </>
        }
        text="Tutta l'app è gratuita e ti mostra quanti soldi puoi recuperare. Con Pro vedi esattamente quali, scarichi il dossier 730 e chiedi qualsiasi cosa al coach AI."
      />
      <div className="mx-auto mt-14 grid max-w-4xl gap-5 md:grid-cols-2">
        <Reveal>
          <SpotlightCard className="flex h-full flex-col gap-6 p-7">
            <div>
              <h3 className={cn(DISPLAY, "text-xl font-semibold text-white")}>Gratis</h3>
              <p className={cn(DISPLAY, "mt-2 text-5xl font-semibold text-white")}>0 €</p>
              <p className="mt-1 text-sm text-white/50">per sempre</p>
            </div>
            <ul className="grid flex-1 gap-2.5 text-sm text-white/75">
              {[
                "Movimenti, conti, budget, obiettivi e debiti illimitati",
                "Inserimento rapido e a voce, import CSV",
                "Previsione, ore di lavoro, analisi e report PDF",
                "Coach con punteggio, consigli e «Posso permettermelo?»",
                "Il mese in storie e conti chiari in coppia",
                "Soldi ritrovati: il totale da recuperare",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/5 font-medium text-white transition-colors hover:bg-white/10"
            >
              Crea un account
            </Link>
          </SpotlightCard>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="lp-glow-border h-full rounded-3xl">
            <SpotlightCard className="flex h-full flex-col gap-6 border-transparent bg-gradient-to-b from-violet-500/[0.12] to-white/[0.03] p-7">
              <div>
                <h3
                  className={cn(
                    DISPLAY,
                    "flex items-center gap-2 text-xl font-semibold text-white",
                  )}
                >
                  Pro <Sparkles className="size-4 text-fuchsia-300" aria-hidden />
                </h3>
                <p className={cn(DISPLAY, "mt-2 text-5xl font-semibold text-white")}>
                  {priceLabel ?? "Presto"}
                </p>
                <p className="mt-1 text-sm text-white/50">
                  {priceLabel
                    ? "disdici quando vuoi, in due clic"
                    : "i pagamenti apriranno a breve"}
                </p>
              </div>
              <ul className="grid flex-1 gap-2.5 text-sm text-white/80">
                {[
                  "Tutto quello che c'è nel piano gratuito",
                  "Soldi ritrovati in dettaglio: le spese detraibili una per una e il dossier 730",
                  "Doppi addebiti, aumenti e rinnovi, con le lettere di disdetta pronte",
                  "Coach AI: chiedi qualsiasi cosa, risponde con i tuoi numeri",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-fuchsia-300" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <PrimaryCta href="/register" className="justify-center">
                Inizia gratis, passa a Pro quando vuoi
              </PrimaryCta>
            </SpotlightCard>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const TRUST = [
  {
    icon: ServerCog,
    title: "Dati in Europa",
    text: "Database a Francoforte, connessioni cifrate, password con bcrypt.",
  },
  {
    icon: ShieldCheck,
    title: "Niente pubblicità",
    text: "Non vendiamo dati e non ti profiliamo. Mai.",
  },
  {
    icon: Trash2,
    title: "Tutto è tuo",
    text: "Scarichi i dati o cancelli l'account con un clic, quando vuoi.",
  },
  {
    icon: Lock,
    title: "AI solo se vuoi",
    text: "Il coach AI legge un riepilogo solo dopo il tuo consenso esplicito.",
  },
];

export function Trust() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.2fr]">
        <div className="relative mx-auto flex size-72 items-center justify-center" aria-hidden>
          {[0, 1, 2].map((ring) => (
            <span
              key={ring}
              className="lp-motion absolute rounded-full border border-emerald-300/20"
              style={{
                inset: ring * 28,
                animation: `lp-orbit ${18 + ring * 8}s linear infinite${ring % 2 ? " reverse" : ""}`,
              }}
            >
              <span className="absolute -top-1 left-1/2 size-2 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" />
            </span>
          ))}
          <span className="flex size-28 items-center justify-center rounded-[2rem] border border-white/15 bg-gradient-to-br from-emerald-400/25 to-cyan-500/10 shadow-[0_0_80px_-10px_rgba(16,185,129,0.7)] backdrop-blur">
            <ShieldCheck className="size-14 text-emerald-200" />
          </span>
        </div>
        <div className="grid gap-8">
          <SectionTitle
            center={false}
            eyebrow="Privacy"
            title={
              <>
                I tuoi dati <span className="lp-gradient-text">restano tuoi.</span>
              </>
            }
            text={
              <>
                Nessun collegamento alla banca: i movimenti li registri tu. Leggi l&apos;
                <Link href="/privacy" className="text-white underline underline-offset-4">
                  informativa sulla privacy
                </Link>
                .
              </>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {TRUST.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 0.06}>
                <SpotlightCard className="h-full p-5">
                  <Icon className="size-5 text-emerald-300" aria-hidden />
                  <p className="mt-3 font-medium text-white">{title}</p>
                  <p className="mt-1 text-sm text-white/55">{text}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "Devo collegare il conto in banca?",
    a: "No. Registri le spese a parole, a voce o importando il CSV della banca. Nessun accesso ai tuoi conti, nessuna credenziale bancaria.",
  },
  {
    q: "Funziona sul telefono?",
    a: "Sì: si apre dal browser e si installa come un'app sulla schermata home. Registra le spese anche offline e le sincronizza appena torni online.",
  },
  {
    q: "Come fa a stimare il rimborso del 730?",
    a: "Riconosce le spese detraibili dalla categoria e dalla descrizione e applica le regole del 19%: franchigie, limiti per tipo e per figlio, pagamento tracciabile. È una stima da verificare col CAF: lo diciamo chiaramente anche nel dossier.",
  },
  {
    q: "Il coach AI legge i miei movimenti?",
    a: "Solo se lo attivi tu: prima ti chiediamo il consenso e ti diciamo a quale fornitore va il riepilogo. Senza consenso il coach funziona lo stesso, con i calcoli fatti dall'app.",
  },
  {
    q: "Posso usarlo in coppia o in famiglia?",
    a: "Sì: inviti chi vuoi nel tuo spazio e vedete gli stessi conti, budget e obiettivi. Conti chiari vi dice chi deve quanto a chi, a metà o in base agli stipendi.",
  },
  {
    q: "E se voglio andarmene?",
    a: "Dalle impostazioni scarichi tutti i tuoi dati in un file e cancelli l'account con un clic. Nessuna domanda.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-24">
      <SectionTitle eyebrow="Domande" title="Domande frequenti" />
      <div className="mt-12 grid gap-3">
        {FAQ.map(({ q, a }, i) => {
          const expanded = open === i;
          return (
            <Reveal key={q} delay={i * 0.04}>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`faq-${i}`}
                  onClick={() => setOpen(expanded ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-white"
                >
                  {q}
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-white/50 transition-transform duration-300",
                      expanded && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      id={`faq-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <p className="px-5 pb-5 text-white/60">{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export function FinalCta() {
  const { setWarp } = useWarp();
  return (
    <section className="relative px-4 py-32">
      <Reveal className="mx-auto grid max-w-3xl justify-items-center gap-6 text-center">
        <p className="text-sm font-medium tracking-[0.4em] text-violet-300/80">3 · 2 · 1</p>
        <h2
          className={cn(
            DISPLAY,
            "text-5xl leading-[1.05] font-semibold text-balance text-white sm:text-7xl",
          )}
        >
          Pronto al <span className="lp-gradient-text">decollo?</span>
        </h2>
        <p className="max-w-xl text-lg text-white/60">
          Crea l&apos;account in trenta secondi. Tra un mese ti racconteremo, in storie, com&apos;è
          andata.
        </p>
        <PrimaryCta href="/register" onHover={setWarp} className="h-14 px-8 text-lg">
          Decolla gratis
        </PrimaryCta>
        <p className="hidden text-sm text-white/40 [@media(pointer:fine)]:block">
          Passa il mouse sul pulsante.
        </p>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-white/50">
        <Logo />
        <nav className="flex flex-wrap gap-5" aria-label="Link utili">
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Termini
          </Link>
          <Link href="/login" className="hover:text-white">
            Accedi
          </Link>
          <Link href="/register" className="hover:text-white">
            Registrati
          </Link>
        </nav>
        <p>© {new Date().getFullYear()} FinTrack · Fatto in Italia</p>
      </div>
    </footer>
  );
}
