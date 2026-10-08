import { Nebula } from "@/components/brand/nebula";
import { CursorGlow, MotionRoot } from "@/components/landing/effects";
import { Hero, Nav } from "@/components/landing/hero";
import {
  Bento,
  FeatureMarquee,
  Gallery,
  Numbers,
  StoryScroll,
  VideoShowcase,
} from "@/components/landing/showcase";
import { FinalCta, Footer, Found730, Faq, Pricing, Trust } from "@/components/landing/closing";
import { FeatureCatalog } from "@/components/landing/feature-catalog";
import { PaysBack } from "@/components/landing/pays-back";
import { StarfieldProvider } from "@/components/landing/starfield";
import { cn } from "@/lib/utils";

/**
 * The public landing page: a dark space scene (stars, nebulae, orbits) around real screenshots
 * and recordings of the app. Always dark, whatever the app theme.
 */
export function Landing({
  priceLabel,
  deleted,
}: {
  /** "4,99 € / mese" from Stripe; null while payments aren't set up. */
  priceLabel: string | null;
  deleted: boolean;
}) {
  return (
    <div
      className={cn(
        "relative isolate min-h-svh overflow-x-clip bg-[#05050c] text-white antialiased [color-scheme:dark] selection:bg-violet-500/40",
      )}
    >
      <Nebula />
      <MotionRoot>
        <StarfieldProvider>
          <CursorGlow />
          <Nav />
          <main className="relative z-10">
            {deleted && (
              <p className="mx-auto mt-24 max-w-xl rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/80 backdrop-blur">
                Il tuo account è stato eliminato, insieme ai tuoi dati. Grazie per aver usato
                FinTrack.
              </p>
            )}
            <Hero />
            <FeatureMarquee />
            <Numbers />
            <PaysBack />
            <StoryScroll />
            <VideoShowcase />
            <FeatureCatalog />
            <Found730 />
            <Bento />
            <Gallery />
            <Pricing priceLabel={priceLabel} />
            <Trust />
            <Faq />
            <FinalCta />
          </main>
          <Footer />
        </StarfieldProvider>
      </MotionRoot>
    </div>
  );
}
