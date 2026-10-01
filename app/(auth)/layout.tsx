import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { Nebula } from "@/components/brand/nebula";
import { StarfieldProvider } from "@/components/landing/starfield";
import { CardSpotlight } from "@/components/layout/card-spotlight";

/**
 * Sign-in, sign-up and the email links: the landing page's night sky (always dark) around a
 * frosted glass card, so the way from the landing page into the app feels like one place.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark app-shell text-foreground relative isolate min-h-svh overflow-x-clip bg-[#05050c] [color-scheme:dark]">
      <Nebula />
      <StarfieldProvider>
        <CardSpotlight />
        <main className="relative z-10 flex min-h-svh flex-col items-center justify-center gap-8 p-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-white">
            <LogoMark />
            <span className="font-display tracking-tight">FinTrack</span>
          </Link>
          {/* The same spinning light border as the landing page's badge. */}
          <div className="lp-rise lp-glow-border w-full max-w-sm rounded-xl [&_[data-slot=card]]:backdrop-blur-xl">
            {children}
          </div>
        </main>
      </StarfieldProvider>
    </div>
  );
}
