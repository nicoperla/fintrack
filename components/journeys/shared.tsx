import { Baby, BriefcaseBusiness, Flower2, House, KeyRound, type LucideIcon } from "lucide-react";
import type { JourneyKey } from "@/lib/journeys/catalog";

export const JOURNEY_ICONS: Record<JourneyKey, LucideIcon> = {
  lavoro: BriefcaseBusiness,
  figlio: Baby,
  affitto: KeyRound,
  casa: House,
  lutto: Flower2,
};

const dayFmt = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
export const fullDay = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00Z`));

/** "tra 5 giorni", "oggi", "2 giorni fa". */
export function relativeDays(days: number) {
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  if (days === -1) return "ieri";
  return days > 0 ? `tra ${days} giorni` : `${-days} giorni fa`;
}

/** "il 15 novembre 2026", "l'8 dicembre 2026": the article before the day, as it's read. */
export const onDay = (iso: string) =>
  `${[1, 8, 11].includes(Number(iso.slice(8, 10))) ? "l'" : "il "}${fullDay(iso)}`;
