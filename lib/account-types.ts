import {
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { AccountType } from "@prisma/client";

export const ACCOUNT_TYPES: Record<AccountType, { label: string; icon: LucideIcon }> = {
  CHECKING: { label: "Conto corrente", icon: Landmark },
  CASH: { label: "Contanti", icon: Banknote },
  CARD: { label: "Carta", icon: CreditCard },
  SAVINGS: { label: "Risparmi", icon: PiggyBank },
  INVESTMENT: { label: "Investimenti", icon: TrendingUp },
};

export const ACCOUNT_TYPE_OPTIONS = Object.entries(ACCOUNT_TYPES).map(([value, meta]) => ({
  value: value as AccountType,
  label: meta.label,
}));

/** Investments are kept apart from the money you can spend (see lib/data/investments.ts). */
export const isInvestment = (type: AccountType) => type === "INVESTMENT";

/** Fixed colours for investment accounts, by creation order; the rest fold into "Altri". */
export const INVESTMENT_SLOTS = 7;
export const slotColor = (slot: number) =>
  slot < INVESTMENT_SLOTS ? `var(--viz-${slot + 1})` : "var(--viz-ref)";
