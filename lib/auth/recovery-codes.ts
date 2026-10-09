import { createHash, randomInt } from "crypto";

/*
 * Recovery codes: ten single-use codes to sign in when the phone with the authenticator app is
 * lost. 10 characters from 31 (no 0/o, 1/l/i): about 49 bits each, so a SHA-256 is enough to
 * store them, and guessing is capped by the sign-in rate limits.
 */

export const RECOVERY_CODE_COUNT = 10;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const LENGTH = 10;

/** "k7m2p-x9qrt" */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  return Array.from({ length: count }, () => {
    let code = "";
    for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}

/** Lower case, no spaces or dashes; null when it can't be a recovery code. */
export function normalizeRecoveryCode(input: string) {
  const clean = input.toLowerCase().replace(/[\s-]/g, "");
  if (clean.length !== LENGTH) return null;
  for (const char of clean) if (!ALPHABET.includes(char)) return null;
  return clean;
}

export const hashRecoveryCode = (normalized: string) =>
  createHash("sha256").update(`recovery:${normalized}`).digest("hex");
