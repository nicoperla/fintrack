import type { Metadata } from "next";
import Link from "next/link";
import { Gavel } from "lucide-react";
import { openRefereePact } from "@/lib/data/pacts";
import { formatCurrency } from "@/lib/format";
import { ilPct } from "@/lib/finance/insights";
import { toDate } from "@/components/true-salary/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// The title stays generic: chat apps show it in their link previews.
export const metadata: Metadata = {
  title: "Il patto · FinTrack",
  robots: { index: false, follow: false },
};

const monthName = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" });
/** "il 25%", "l'85%". */
const pct = (n: number) => ilPct(n * 100);

/** What the referee sees: the pact, how much of the limit is gone, the verdict. No movements. */
export default async function RefereePage({ params }: { params: { token: string } }) {
  const pact = await openRefereePact(params.token);

  if (!pact) {
    return (
      <div className="grid gap-2 py-16 text-center">
        <h1 className="text-xl font-semibold">Questo link non funziona più</h1>
        <p className="text-muted-foreground text-sm">
          Il patto è finito da più di un mese, il link è stato revocato oppure non è scritto per
          intero. Chiedi a chi te l&apos;ha mandato di crearne uno nuovo.
        </p>
      </div>
    );
  }

  const s = pact.status;
  const money = (n: number) => formatCurrency(n, pact.currency);
  const period = pact.from.endsWith("-01")
    ? `per tutto ${monthName.format(new Date(`${pact.to}T00:00:00Z`))}`
    : `fino ${toDate(pact.to)}`;
  const verdict =
    s.state === "upcoming"
      ? "Il patto non è ancora cominciato."
      : s.state === "active"
        ? `Finora ha usato ${pct(s.used)} del limite. ${s.daysLeft === 1 ? "Oggi è l'ultimo giorno." : `Mancano ${s.daysLeft} giorni.`}`
        : s.state === "won"
          ? `Patto rispettato: ha usato ${pct(s.used)} del limite.`
          : "Patto perso: il limite è stato superato.";

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid gap-2">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Gavel className="size-4" aria-hidden />
          {pact.referee ? `${pact.referee}, fai tu da arbitro` : "Fai tu da arbitro"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Il patto di {pact.author}: al massimo {money(pact.limit)} in «{pact.category}» {period}
        </h1>
      </div>

      <section
        className={cn(
          "grid gap-3 rounded-2xl border p-5",
          s.state === "won" && "border-emerald-500/40 bg-emerald-500/5",
          s.state === "lost" && "border-red-500/40 bg-red-500/5",
        )}
      >
        {s.state !== "upcoming" && (
          <div className="bg-muted h-3 rounded-full" aria-hidden>
            <div
              className={cn(
                "h-full rounded-full",
                s.state === "lost" ? "bg-red-500" : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(1, s.used) * 100}%` }}
            />
          </div>
        )}
        <p className="text-lg font-medium">{verdict}</p>
        {(pact.promise || pact.fine) && (
          <ul className="grid gap-1 text-sm">
            {pact.promise && (
              <li>
                <span className="text-muted-foreground">Se perde, ha promesso: </span>«
                {pact.promise}»
              </li>
            )}
            {pact.fine && (
              <li>
                <span className="text-muted-foreground">E mette da parte </span>
                {money(pact.fine.amount)}
                <span className="text-muted-foreground"> nel suo salvadanaio</span>
                {s.state === "lost" && (pact.fine.paid ? ": fatto." : ": non ancora.")}
              </li>
            )}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground text-sm">
        Il controllo lo fa FinTrack sulle spese che {pact.author} registra: tu non devi fare niente,
        solo ricordarglielo al momento giusto. Non vedi i suoi movimenti, solo quanto del limite ha
        usato. Il link funziona fino {toDate(pact.expiresOn)}.
      </p>
      <p className="text-muted-foreground text-xs">
        FinTrack è un&apos;app per i soldi di casa.{" "}
        <Link href="/" className="underline underline-offset-2">
          Scopri com&apos;è fatta
        </Link>
        .
      </p>
    </div>
  );
}
