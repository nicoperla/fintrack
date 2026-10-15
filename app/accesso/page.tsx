import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { KeyRound, Lock } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { Nebula } from "@/components/brand/nebula";
import { StarfieldProvider } from "@/components/landing/starfield";
import { GATE_COOKIE, gateEnabled, safeNext, validPass } from "@/lib/gate";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Accesso riservato · Orbitly",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  codice: "Codice non valido. Controllalo e riprova.",
  troppi: "Troppi tentativi da questa connessione. Riprova tra un quarto d'ora.",
};

type SearchParams = { next?: string | string[]; errore?: string | string[] };

/**
 * The pre-launch gate (lib/gate.ts): until Orbitly opens to the public, this is the only page
 * anyone can see without the access code.
 */
export default async function AccessPage({ searchParams }: { searchParams: SearchParams }) {
  const next = safeNext(typeof searchParams.next === "string" ? searchParams.next : null);
  if (!gateEnabled() || (await validPass(cookies().get(GATE_COOKIE)?.value))) redirect(next);
  const error = typeof searchParams.errore === "string" ? ERRORS[searchParams.errore] : undefined;

  return (
    <div className="dark app-shell text-foreground relative isolate min-h-svh overflow-x-clip bg-[#05050c] [color-scheme:dark]">
      <Nebula />
      <StarfieldProvider>
        <main className="relative z-10 flex min-h-svh flex-col items-center justify-center gap-8 p-4">
          <div className="flex items-center gap-2 text-xl font-semibold text-white">
            <LogoMark />
            <span className="font-display tracking-tight">Orbitly</span>
          </div>
          <div className="lp-rise lp-glow-border w-full max-w-sm rounded-2xl">
            <div className="bg-card/80 grid gap-5 rounded-2xl p-6 ring-1 ring-white/10 backdrop-blur-xl">
              <div className="grid justify-items-center gap-3 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_10px_30px_-10px_rgba(139,92,246,0.9)]">
                  <Lock className="size-5" aria-hidden />
                </span>
                <h1 className="font-display text-xl font-semibold tracking-tight">
                  Accesso riservato
                </h1>
                <p className="text-muted-foreground text-sm">
                  Orbitly non è ancora aperto al pubblico. Se hai ricevuto un codice di accesso,
                  inseriscilo qui.
                </p>
              </div>

              <form method="post" action="/api/accesso" className="grid gap-3">
                <input type="hidden" name="next" value={next} />
                <label htmlFor="code" className="sr-only">
                  Codice di accesso
                </label>
                <div className="relative">
                  <KeyRound
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden
                  />
                  <input
                    id="code"
                    name="code"
                    type="text"
                    required
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={40}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "code-error" : undefined}
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-12 w-full rounded-xl border bg-white/5 pr-3 pl-9 font-mono text-base tracking-[0.18em] uppercase outline-none placeholder:tracking-[0.18em] placeholder:text-white/25 focus-visible:ring-3"
                  />
                </div>
                {error && (
                  <p id="code-error" role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn-cosmic h-11 rounded-xl text-sm font-semibold text-white hover:brightness-110 focus-visible:ring-3 focus-visible:ring-violet-400/50 focus-visible:outline-none"
                >
                  Entra
                </button>
              </form>
            </div>
          </div>
          <p className="text-xs text-white/35">© {new Date().getFullYear()} Orbitly</p>
        </main>
      </StarfieldProvider>
    </div>
  );
}
