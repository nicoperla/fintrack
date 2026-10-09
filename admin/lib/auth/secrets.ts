import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  randomInt,
} from "crypto";
import bcrypt from "bcryptjs";
import { adminSecret } from "@/lib/config";

/*
 * The admin's credentials: bcrypt for the password, AES-256-GCM for the 2FA secret (key derived
 * from ADMIN_SECRET), SHA-256 for the recovery codes (high entropy).
 */

const BCRYPT_ROUNDS = 12;
/** Compared against when the email is unknown, so timing doesn't tell admins apart. */
export const DUMMY_HASH = "$2b$12$GNMrHoKeK2LNEa.gtMgSDOro/8YpSF.ZdEXbGrUIb/RF3mSVayrhe";

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

function boxKey() {
  return Buffer.from(
    hkdfSync("sha256", adminSecret(), "fintrack-admin", "fintrack-admin:totp:v1", 32),
  );
}

export function seal(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", boxKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function open(box: string) {
  const [version, iv, tag, data] = box.split(".");
  if (version !== "v1" || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", boxKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Ten single-use codes like "k7m2p-x9qrt" (about 49 bits each). */
export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    let code = "";
    for (let i = 0; i < 10; i++) code += ALPHABET[randomInt(ALPHABET.length)];
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}

export function normalizeRecoveryCode(input: string) {
  const clean = input.toLowerCase().replace(/[\s-]/g, "");
  if (clean.length !== 10) return null;
  for (const char of clean) if (!ALPHABET.includes(char)) return null;
  return clean;
}

export const hashRecoveryCode = (normalized: string) =>
  createHash("sha256").update(`admin-recovery:${normalized}`).digest("hex");

/** Password rules for the admin: longer than FinTrack's, it opens everything. */
export function adminPasswordProblem(password: string, email: string) {
  if (password.length < 12) return "Almeno 12 caratteri";
  if (password.length > 72) return "Al massimo 72 caratteri";
  const local = email.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
    return "Non usare la tua email nella password";
  }
  if (new Set(password.toLowerCase()).size < 6) return "Troppo prevedibile";
  return null;
}
