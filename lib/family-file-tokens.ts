import { createHash, randomBytes } from "crypto";

/* Tokens of the family file links: 256 random bits, of which only the SHA-256 is stored. */

export function newShareToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashShareToken(token) };
}

export const hashShareToken = (token: string) => createHash("sha256").update(token).digest("hex");
