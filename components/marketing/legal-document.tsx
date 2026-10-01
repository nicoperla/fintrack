import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

/** Typography for the privacy policy and the terms (no prose plugin in the project). */
export function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="grid gap-6 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5">
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">Ultimo aggiornamento: {LEGAL.updatedAt}</p>
      </header>
      {children}
    </article>
  );
}

export function ContactLine() {
  return LEGAL.email ? (
    <>
      scrivendo a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
    </>
  ) : (
    <>contattando il titolare</>
  );
}
