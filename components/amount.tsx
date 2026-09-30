"use client";

import { MASKED_AMOUNT, useAmountsHidden, useMoney } from "@/components/currency-provider";

/** An amount rendered by a server component that still follows discreet mode. */
export function Amount({ value, currency }: { value: number; currency?: string }) {
  const money = useMoney();
  return <>{money(value, currency)}</>;
}

// "1.234,56 €", "-12,00 USD", "5 $": amounts inside sentences generated on the server.
// (\s also matches the no-break spaces Intl puts before the currency.)
const AMOUNT_IN_TEXT = /[-−+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s?(€|[A-Z]{3}\b|[$£¥])/g;

export const maskAmounts = (text: string) => text.replace(AMOUNT_IN_TEXT, `${MASKED_AMOUNT} $1`);

/** Text with amounts in it (insights, notices): in discreet mode the figures are masked. */
export function MaskedText({ text }: { text: string }) {
  const hidden = useAmountsHidden();
  return <>{hidden ? maskAmounts(text) : text}</>;
}
