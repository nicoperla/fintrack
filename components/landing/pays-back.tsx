"use client";

import { motion } from "motion/react";
import { Check, FileText, Gavel, HandCoins, Search, Send } from "lucide-react";
import { CountUp, Reveal, SpotlightCard } from "@/components/landing/effects";
import { DISPLAY, PrimaryCta } from "@/components/landing/hero";
import { SectionTitle } from "@/components/landing/showcase";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Search,
    title: "Trova",
    text: "Mentre registri le spese, FinTrack cerca i soldi persi: rimborsi del 730, doppi addebiti, abbonamenti aumentati, commissioni.",
  },
  {
    icon: FileText,
    title: "Prepara",
    text: "Per ognuno c'è la lettera giusta, con le norme giuste: disdetta, rimborso dell'addebito, reclamo alla banca.",
  },
  {
    icon: Send,
    title: "Invia",
    text: "La mandi tu, per email, PEC o raccomandata. FinTrack segna le scadenze di legge per la risposta.",
  },
  {
    icon: HandCoins,
    title: "Recupera",
    text: "Ti dice il passo successivo se non rispondono, e conta i soldi che ti sei ripreso.",
  },
];

/** Facts anyone can check: where money is left on the table. */
const FACTS = [
  {
    figure: "19%",
    text: "delle spese mediche oltre 129,11 € l'anno torna con il 730, se le hai pagate in modo tracciabile.",
  },
  {
    figure: "8 settimane",
    text: "per farti rimborsare un addebito diretto SEPA dalla tua banca, senza dover spiegare perché.",
  },
  {
    figure: "119,88 €",
    text: "l'anno: quanto costa un abbonamento da 9,99 € al mese che non usi più.",
  },
  {
    figure: "60 giorni",
    text: "per la risposta a un reclamo alla banca. Se non arriva, si va all'Arbitro Bancario Finanziario.",
  },
];

const TIMELINE = [
  { text: "Addebito arrivato dopo la disdetta", detail: "FitLife Palestra · 39,90 €", done: true },
  { text: "Lettera di rimborso pronta", detail: "artt. 13-14 del d.lgs. 11/2010", done: true },
  { text: "Inviata alla banca", detail: "Risposta entro 10 giornate lavorative", done: true },
  { text: "Rimborsato", detail: "+39,90 € sul conto", done: true },
];

/** The reason to pay: FinTrack finds money and helps getting it back. */
export function PaysBack() {
  return (
    <section id="recupera" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
      <SectionTitle
        eyebrow="Si ripaga da solo"
        title={
          <>
            Non solo conti. <span className="lp-gradient-text">Soldi che tornano a te.</span>
          </>
        }
        text="Le altre app ti mostrano dove sono finiti i soldi. FinTrack va a cercare quelli che stai perdendo e ti aiuta a riprenderteli, con le regole italiane."
      />

      <div className="mt-16 grid items-center gap-12 lg:grid-cols-2">
        <ol className="grid gap-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <li className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-400/25 to-cyan-500/10">
                  <Icon className="size-5 text-emerald-200" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-white">
                    <span className="mr-2 text-white/35">{i + 1}</span>
                    {title}
                  </p>
                  <p className="text-white/60">{text}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.1} className="relative">
          <div
            aria-hidden
            className="absolute -inset-8 -z-10 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.3),transparent_65%)] blur-2xl"
          />
          <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-white">
                <Gavel className="size-4 text-emerald-300" aria-hidden /> Riprenditeli · una pratica
              </p>
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                Vinta
              </span>
            </div>
            <ol className="grid gap-3">
              {TIMELINE.map((step, i) => (
                <motion.li
                  key={step.text}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: 0.25 + i * 0.3, duration: 0.5, ease: "easeOut" }}
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                    <Check className="size-3.5 text-emerald-300" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-white">{step.text}</span>
                    <span className="text-xs text-white/50">{step.detail}</span>
                  </span>
                </motion.li>
              ))}
            </ol>
            <div
              className="rounded-2xl p-4 text-white"
              style={{ background: "linear-gradient(135deg, #047857, #0d9488 55%, #0369a1)" }}
            >
              <p className="text-sm text-white/80">Ripresi quest&apos;anno</p>
              <p className={cn(DISPLAY, "text-4xl font-semibold tabular-nums")}>
                <CountUp
                  to={284.7}
                  format={(n) => `${n.toFixed(2).replace(".", ",")} €`}
                  duration={2.4}
                />
              </p>
              <p className="text-xs text-white/70">
                Un esempio: quanto recuperi dipende dalle tue spese
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map((f, i) => (
          <Reveal key={f.figure} delay={i * 0.06}>
            <SpotlightCard className="h-full p-5">
              <p className={cn(DISPLAY, "lp-gradient-text text-3xl font-semibold")}>{f.figure}</p>
              <p className="mt-2 text-sm text-white/60">{f.text}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-12 flex flex-col items-center gap-3 text-center">
        <PrimaryCta href="/register">Trova i tuoi soldi persi</PrimaryCta>
        <p className="max-w-md text-sm text-white/50">
          Il contatore è gratis e parte dal primo movimento. Con Pro vedi ogni voce una per una e
          apri tutte le pratiche che vuoi.
        </p>
      </Reveal>
    </section>
  );
}
