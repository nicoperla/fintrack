/*
 * The panel's session: a small signed token in an httpOnly cookie, `payload.signature`, HMAC
 * SHA-256 with a key derived from ADMIN_SECRET. Web Crypto only, so the middleware (edge) can
 * check it too. The server also compares the version with the database (lib/auth/session.ts),
 * so changing the password or "sign out everywhere" ends every session at once.
 */

export const SESSION_HOURS = 8;

export type SessionPayload = {
  /** Admin id. */
  a: string;
  /** The admin's session version when signing in. */
  v: number;
  /** Issued and expiry times, seconds. */
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string) {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const keys = new Map<string, Promise<CryptoKey>>();

/** HMAC key for sessions, derived (HKDF) so ADMIN_SECRET itself is never the key. */
function sessionKey(secret: string) {
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle
      .importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"])
      .then((base) =>
        crypto.subtle.deriveKey(
          {
            name: "HKDF",
            hash: "SHA-256",
            salt: encoder.encode("fintrack-admin"),
            info: encoder.encode("fintrack-admin:session:v1"),
          },
          base,
          { name: "HMAC", hash: "SHA-256", length: 256 },
          false,
          ["sign", "verify"],
        ),
      );
    keys.set(secret, key);
  }
  return key;
}

export async function signSession(
  secret: string,
  adminId: string,
  version: number,
  now = Date.now(),
) {
  const iat = Math.floor(now / 1000);
  const payload: SessionPayload = { a: adminId, v: version, iat, exp: iat + SESSION_HOURS * 3600 };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await sessionKey(secret),
    encoder.encode(body),
  );
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** The payload of a valid, unexpired token; null for anything else. */
export async function verifySession(
  secret: string,
  token: string | undefined,
  now = Date.now(),
): Promise<SessionPayload | null> {
  if (!token || token.length > 1000) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  try {
    // crypto.subtle.verify compares in constant time.
    const valid = await crypto.subtle.verify(
      "HMAC",
      await sessionKey(secret),
      fromBase64Url(signature),
      encoder.encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.a !== "string" || typeof payload.v !== "number") return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieName = (secure: boolean) =>
  secure ? "__Host-fintrack-admin" : "fintrack-admin";
