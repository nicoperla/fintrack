"use client";

import { Lightbulb, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaxSection, TONE_BOX, useAction } from "@/components/tax/ui";
import { setShareCapacity } from "@/app/(dashboard)/730/actions";
import type { CoupleView } from "@/lib/data/my730-couple";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  none: "Niente imposta: le detrazioni andrebbero perse",
  low: "Poca imposta: una parte delle detrazioni andrebbe persa",
  enough: "Abbastanza imposta per le detrazioni",
  unknown: "Manca la CU per saperlo",
  hidden: "Non lo condivide",
};

/** "Chi detrae cosa": in whose 730 the shared expenses are worth more, never showing amounts. */
export function CoupleCard({ year, couple }: { year: number; couple: CoupleView }) {
  const { pending, run } = useAction();
  return (
    <TaxSection
      id="coppia"
      icon={UsersRound}
      title="Chi detrae cosa"
      subtitle="Le spese dei figli si possono mettere nel 730 di chi ha più imposta da cui toglierle. Nessuno vede gli importi degli altri."
      aside={
        <Button
          variant={couple.share ? "ghost" : "default"}
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => setShareCapacity(year, !couple.share),
              couple.share ? "Non condividi più" : "Condiviso con lo spazio",
            )
          }
        >
          {couple.share ? "Smetti di condividere" : "Condividi la mia capienza"}
        </Button>
      }
    >
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        <li className="rounded-xl border p-3">
          <p className="font-medium">Tu</p>
          <p className="text-muted-foreground">{LABELS[couple.mine]}</p>
        </li>
        {couple.others.map((o) => (
          <li key={o.name} className="rounded-xl border p-3">
            <p className="font-medium">{o.name}</p>
            <p className="text-muted-foreground">{LABELS[o.capacity]}</p>
          </li>
        ))}
      </ul>
      {couple.advice ? (
        <p className={cn("flex gap-2 rounded-xl border p-3 text-sm", TONE_BOX.info)}>
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
          <span>
            {couple.advice} Basta intestare il documento al figlio e scrivere sulla ricevuta chi
            l&apos;ha pagata e in che percentuale. Le spese tue personali restano nel tuo 730.
          </span>
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          {couple.share
            ? "Quando anche gli altri condividono la loro capienza (e hanno inserito la CU), ti dico in quale 730 conviene mettere le spese dei figli."
            : "Condividi la tua capienza: gli altri vedono solo se hai imposta sufficiente, mai i tuoi redditi o le tue spese."}
        </p>
      )}
    </TaxSection>
  );
}
