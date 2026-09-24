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
