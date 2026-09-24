const MAX_INTEGER_DIGITS = 12;

/**
 * Parses a user-typed amount ("12,50", "1.234,56", "1234.5", "€ 30") into a canonical
 * "1234.56" string, or null if invalid. Negative values are rejected: the sign comes from the type.
 */
export function parseAmount(input: string): string | null {
  let value = input.replace(/[\s€]/g, "");
  if (!value) return null;

  if (value.includes(",")) {
    // Italian format: dots are thousand separators, comma is the decimal separator.
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replace(/\./g, "");
  }

  const match = value.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const integer = match[1].replace(/^0+(?=\d)/, "");
  if (integer.length > MAX_INTEGER_DIGITS) return null;
  const decimals = (match[2] ?? "").padEnd(2, "0");
  return `${integer}.${decimals}`;
}

/** Like parseAmount, but allows a leading minus (e.g. a credit card's opening balance). */
export function parseSignedAmount(input: string): string | null {
  const trimmed = input.trim();
  const negative = trimmed.startsWith("-");
  const parsed = parseAmount(negative ? trimmed.slice(1) : trimmed);
  if (parsed === null) return null;
  return negative && Number(parsed) !== 0 ? `-${parsed}` : parsed;
}
