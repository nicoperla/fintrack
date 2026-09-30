"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { currencySymbol, formatCurrency } from "@/lib/format";
import { formatWorkTime, type WorkRate } from "@/lib/finance/work-time";
import { HIDE_AMOUNTS_COOKIE } from "@/lib/privacy";

type SpaceInfo = {
  /** The active space's base currency: totals, budgets, goals and debts are expressed in it. */
  currency: string;
  /** Whether other people share the space (then we show who recorded what). */
  shared: boolean;
  /** Who is signed in and where: offline entries are tied to both. */
  spaceId: string;
  userId: string;
  /** Net income per working hour, to show amounts as working time; null when unknown or off. */
  workRate: WorkRate | null;
};

type SpaceContextValue = SpaceInfo & {
  /** "Discreet mode": amounts are masked, e.g. to use the app in public. */
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
};

const SpaceContext = createContext<SpaceContextValue>({
  currency: "EUR",
  shared: false,
  spaceId: "",
  userId: "",
  workRate: null,
  hidden: false,
  setHidden: () => {},
});

export function CurrencyProvider({
  children,
  initialHidden = false,
  ...value
}: SpaceInfo & { initialHidden?: boolean; children: ReactNode }) {
  const [hidden, setHiddenState] = useState(initialHidden);
  const setHidden = useCallback((next: boolean) => {
    setHiddenState(next);
    document.cookie = next
      ? `${HIDE_AMOUNTS_COOKIE}=1; path=/; max-age=31536000; samesite=lax`
      : `${HIDE_AMOUNTS_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }, []);
  return (
    <SpaceContext.Provider value={{ ...value, hidden, setHidden }}>
      {children}
    </SpaceContext.Provider>
  );
}

export const useCurrency = () => useContext(SpaceContext).currency;
export const useSharedSpace = () => useContext(SpaceContext).shared;
export const useSpaceInfo = () => useContext(SpaceContext);
export const useAmountsHidden = () => useContext(SpaceContext).hidden;

export const MASKED_AMOUNT = "••••";

/**
 * Formats an amount in the space currency, or in `currency` (e.g. an account's own). In discreet
 * mode only the currency is shown.
 */
export function useMoney() {
  const { currency: base, hidden } = useContext(SpaceContext);
  return useCallback(
    (value: Parameters<typeof formatCurrency>[0], currency?: string) =>
      hidden
        ? `${MASKED_AMOUNT} ${currencySymbol(currency ?? base)}`
        : formatCurrency(value, currency ?? base),
    [base, hidden],
  );
}

/**
 * "2 h 15 min" for an amount in the space currency, or null when there's nothing to say: no
 * income known, feature turned off, another currency, or amounts hidden (it would give them away).
 */
export function useWorkTime() {
  const { currency: base, hidden, workRate } = useContext(SpaceContext);
  return useCallback(
    (amount: number, currency?: string) =>
      !workRate || hidden || (currency && currency !== base) || !(amount > 0)
        ? null
        : formatWorkTime(amount, workRate),
    [base, hidden, workRate],
  );
}

export { currencySymbol };

export function useCurrencySymbol() {
  return currencySymbol(useCurrency());
}

/** Like useMoney, rounded to whole units: for large figures in charts and projections. */
export function useWholeMoney() {
  const { currency: base, hidden } = useContext(SpaceContext);
  return useCallback(
    (value: number) =>
      hidden
        ? `${MASKED_AMOUNT} ${currencySymbol(base)}`
        : new Intl.NumberFormat("it-IT", {
            style: "currency",
            currency: base,
            maximumFractionDigits: 0,
            useGrouping: "always",
          }).format(value),
    [base, hidden],
  );
}
