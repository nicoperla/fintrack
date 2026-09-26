"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { currencySymbol, formatCurrency } from "@/lib/format";

type SpaceInfo = {
  /** The active space's base currency: totals, budgets, goals and debts are expressed in it. */
  currency: string;
  /** Whether other people share the space (then we show who recorded what). */
  shared: boolean;
  /** Who is signed in and where: offline entries are tied to both. */
  spaceId: string;
  userId: string;
};

const SpaceContext = createContext<SpaceInfo>({
  currency: "EUR",
  shared: false,
  spaceId: "",
  userId: "",
});

export function CurrencyProvider({ children, ...value }: SpaceInfo & { children: ReactNode }) {
  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export const useCurrency = () => useContext(SpaceContext).currency;
export const useSharedSpace = () => useContext(SpaceContext).shared;
export const useSpaceInfo = () => useContext(SpaceContext);

/** Formats an amount in the space currency, or in `currency` (e.g. an account's own). */
export function useMoney() {
  const base = useCurrency();
  return useCallback(
    (value: Parameters<typeof formatCurrency>[0], currency?: string) =>
      formatCurrency(value, currency ?? base),
    [base],
  );
}

export { currencySymbol };

export function useCurrencySymbol() {
  return currencySymbol(useCurrency());
}
