"use client";

import { useState } from "react";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoachProfileForm } from "@/components/coach/coach-profile-form";
import { COACH_METHODS, type CoachProfile } from "@/lib/finance/coach-profile";

type Category = { id: string; name: string; icon: string | null; color: string | null };

/** The "your style" button, with the profile form in a dialog. */
export function CoachStyleButton({
  profile,
  categories,
}: {
  profile: CoachProfile;
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <SlidersHorizontal />
        Il tuo stile: {COACH_METHODS[profile.method].label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Come vuoi gestire i tuoi soldi?</DialogTitle>
            <DialogDescription>
              Il coach giudica i tuoi numeri con le tue regole, non con quelle di qualcun altro.
            </DialogDescription>
          </DialogHeader>
          <CoachProfileForm
            profile={profile}
            categories={categories}
            onSaved={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** First visit: the coach asks before it judges. */
export function CoachSetup({
  profile,
  categories,
}: {
  profile: CoachProfile;
  categories: Category[];
}) {
  return (
    <section
      className="bg-card grid gap-5 rounded-2xl border p-5 sm:p-6"
      style={{
        background:
          "linear-gradient(160deg, color-mix(in oklch, var(--viz-income) 10%, var(--card)), var(--card) 55%)",
      }}
      aria-labelledby="setup-title"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
        >
          <Sparkles className="size-5" />
        </span>
        <div>
          <h2 id="setup-title" className="text-lg font-semibold">
            Prima di tutto: come vuoi gestire i tuoi soldi?
          </h2>
          <p className="text-muted-foreground text-sm">
            Due minuti e ti do consigli su misura. Qui sotto intanto vedi cosa noto con le
            impostazioni standard.
          </p>
        </div>
      </div>
      <CoachProfileForm profile={profile} categories={categories} />
    </section>
  );
}
