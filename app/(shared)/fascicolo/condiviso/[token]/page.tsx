import type { Metadata } from "next";
import { FamilyFileDocument } from "@/components/family-file/family-file-document";
import { PrintButton } from "@/components/family-file/print-button";
import { openSharedFamilyFile } from "@/lib/data/family-file";

export const dynamic = "force-dynamic";

// The title stays generic: chat apps show it in their link previews.
export const metadata: Metadata = {
  title: "Fascicolo di famiglia · FinTrack",
  robots: { index: false, follow: false },
};

const longDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Rome",
});

export default async function SharedFamilyFilePage({ params }: { params: { token: string } }) {
  const shared = await openSharedFamilyFile(params.token);

  if (!shared) {
    return (
      <div className="grid gap-2 py-16 text-center">
        <h1 className="text-xl font-semibold">Questo link non funziona più</h1>
        <p className="text-muted-foreground text-sm">
          È scaduto, è stato revocato oppure non è scritto per intero. Chiedi a chi te l&apos;ha
          mandato di crearne uno nuovo.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-muted-foreground text-sm">
          Condiviso con {shared.label}, fino al {longDate.format(new Date(shared.expiresAt))}.
        </p>
        <PrintButton />
      </div>
      <div className="bg-card rounded-2xl border p-5 sm:p-8 print:border-0 print:p-0">
        <FamilyFileDocument content={shared.content} />
      </div>
    </div>
  );
}
