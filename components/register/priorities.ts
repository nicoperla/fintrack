import {
  Baby,
  HandCoins,
  House,
  Plane,
  ShieldCheck,
  Sunset,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { CoachPriority } from "@/lib/finance/coach-profile";

/*
 * The coach's priorities (lib/finance/coach-profile.ts) as the sign-up shows them, and where the
 * first-run screen sends the user once the account is ready.
 */

export const PRIORITY_ICONS: Record<CoachPriority, LucideIcon> = {
  "fondo-emergenza": ShieldCheck,
  debiti: HandCoins,
  vizi: Wallet,
  casa: House,
  viaggi: Plane,
  investire: TrendingUp,
  pensione: Sunset,
  figli: Baby,
};

export const PRIORITY_START: Record<CoachPriority, { href: string; action: string }> = {
  "fondo-emergenza": { href: "/goals", action: "Crea il tuo cuscinetto" },
  debiti: { href: "/debts", action: "Pianifica il rientro" },
  vizi: { href: "/budgets", action: "Metti un tetto alle spese" },
  casa: { href: "/goals", action: "Un obiettivo per la casa" },
  viaggi: { href: "/goals", action: "Un obiettivo per il viaggio" },
  investire: { href: "/investments", action: "Segui i tuoi investimenti" },
  pensione: { href: "/simulator", action: "Simula quanto metterai da parte" },
  figli: { href: "/goals", action: "Un obiettivo per i figli" },
};
