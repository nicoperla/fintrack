"use client";

import Link from "next/link";
import { ChevronRight, FileSearch, ShieldCheck } from "lucide-react";
import { RentCheck, WelfareCheck } from "@/components/rights/radar-forms";
import { RULES_CHECKED_AT } from "@/lib/finance/deductions";
import type { RightsRadar } from "@/lib/data/rights";

export function RadarView({ data }: { data: RightsRadar }) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link
        href={`/730?anno=${data.year}#precompilato`}
        className="bg-card hover:bg-muted/40 group flex items-center gap-3 rounded-2xl border p-4 transition-colors"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400">
          <FileSearch className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Il confronto col precompilato è in «Il mio 730»</p>
          <p className="text-muted-foreground text-sm">
            Anche dal PDF, riga per riga, con il rigo dove scrivere quello che manca.
          </p>
        </div>
        <ChevronRight
          className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
      <RentCheck data={data} />
      <WelfareCheck data={data} />
      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Orbitly ti informa, non fa assistenza fiscale: il 730 lo modifichi tu sul sito
          dell&apos;Agenzia delle Entrate, oppure con un CAF o un professionista. Le cifre sono
          stime; regole verificate a {RULES_CHECKED_AT}.
        </span>
      </p>
    </div>
  );
}
