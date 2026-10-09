import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

/*
 * Encryption at rest for secrets the server must read back (the 2FA secret): a copy of the
 * database alone isn't enough to generate someone's codes. AES-256-GCM, with a key derived from
 * TWO_FACTOR_KEY or, when that isn't set, from NEXTAUTH_SECRET. Changing that value makes the
 * stored secrets unreadable: those users sign in with a recovery code and set 2FA up again.
 */

const VERSION = "v1";

function key() {
  const source = process.env.TWO_FACTOR_KEY || process.env.NEXTAUTH_SECRET;
  if (!source) throw new Error("NEXTAUTH_SECRET (o TWO_FACTOR_KEY) non configurata");
  return Buffer.from(hkdfSync("sha256", source, "fintrack", "fintrack:secret-box:v1", 32));
}

export function seal(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, data]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

/** The plain text, or null when the box was sealed with another key or tampered with. */
export function open(box: string) {
  const [version, iv, tag, data] = box.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
