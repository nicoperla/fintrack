import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/*
 * Time-based one-time passwords (RFC 6238): the six digits shown by Google Authenticator,
 * Microsoft Authenticator, 1Password, Authy… HMAC-SHA1, 30-second steps, as every app expects.
 */

export const TOTP_PERIOD = 30;
export const TOTP_DIGITS = 6;
/** Steps accepted on each side of now: the phone's clock may be a few seconds off. */
const DRIFT_STEPS = 1;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string) {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Carattere base32 non valido");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 random bits, the size RFC 4226 recommends, as the base32 the apps take. */
export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export const totpStep = (now = Date.now()) => Math.floor(now / 1000 / TOTP_PERIOD);

export function totpCode(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

/** "123 456", "123-456" → "123456"; null when it can't be a code. */
export function normalizeTotp(input: string) {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

/**
 * The step whose code matches, or null. A step at or before `lastStep` is refused, so a code
 * seen over someone's shoulder can't be used again.
 */
export function verifyTotp(
  secret: string,
  input: string,
  { now = Date.now(), lastStep = null }: { now?: number; lastStep?: number | null } = {},
) {
  const code = normalizeTotp(input);
  if (!code) return null;
  const current = totpStep(now);
  let matched: number | null = null;
  // Every candidate is compared, so the time taken doesn't tell which one matched.
  for (let step = current - DRIFT_STEPS; step <= current + DRIFT_STEPS; step++) {
    const expected = Buffer.from(totpCode(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code)) && matched === null) matched = step;
  }
  if (matched === null || (lastStep !== null && matched <= lastStep)) return null;
  return matched;
}

/** The link an authenticator app reads from the QR code. */
export function otpauthUri(secret: string, account: string, issuer = "FinTrack") {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD),
  });
  return `otpauth://totp/${label}?${params}`;
}

/** "ABCD EFGH IJKL…": easier to type by hand when the camera can't read the QR code. */
export const groupSecret = (secret: string) => secret.replace(/(.{4})(?=.)/g, "$1 ");
