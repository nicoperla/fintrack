import { Download, Eye } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FamilyFileDocument } from "@/components/family-file/family-file-document";
import { FamilyNotesForm } from "@/components/family-file/notes-form";
import { SharePanel } from "@/components/family-file/share-panel";
import { requireSpace } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasPro } from "@/lib/billing/plan";
import { getFamilyFileInput, getFamilyShares } from "@/lib/data/family-file";
import { buildFamilyFile } from "@/lib/family-file";

export const metadata = { title: "Fascicolo di famiglia · FinTrack" };

export default async function FamilyFilePage() {
  const space = await requireSpace();
  const [input, shares, user] = await Promise.all([
    getFamilyFileInput(space.id),
    getFamilyShares(space.id),
    prisma.user.findUniqueOrThrow({ where: { id: space.user.id }, select: { plan: true } }),
  ]);
  const pro = hasPro(user);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Il fascicolo di famiglia</h1>
          <p className="text-muted-foreground text-sm">
            Quello che chi ti è vicino dovrebbe sapere se un giorno non potessi dirglielo tu: dove
            sono i soldi, cosa disdire, chi chiamare.
          </p>
        </div>
        {pro && (
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/fascicolo/pdf"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download /> PDF senza importi
            </a>
            <a
              href="/api/fascicolo/pdf?importi=1"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download /> PDF con importi
            </a>
          </div>
        )}
      </div>

      <FamilyNotesForm notes={input.notes} />
      <SharePanel shares={shares} owner={space.role === "OWNER"} pro={pro} />

      <section
        aria-labelledby="anteprima-title"
        className="bg-card grid grid-cols-1 gap-4 rounded-2xl border p-5"
      >
        <h2 id="anteprima-title" className="flex items-center gap-2 font-medium">
          <Eye className="size-4" aria-hidden /> Così lo vede chi lo riceve
        </h2>
        <div className="rounded-xl border p-4 sm:p-6">
          <FamilyFileDocument content={buildFamilyFile(input, { showAmounts: false })} />
        </div>
      </section>
    </div>
  );
}
