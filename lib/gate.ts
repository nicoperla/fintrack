/*
 * The pre-launch gate: until Orbitly opens to the public, every request (landing page, sign-in,
 * the app, its APIs, even the pictures and videos) needs an access code first. The middleware
 * checks a signed pass cookie; /accesso asks for the code and /api/accesso issues the pass.
 *
 * Runs in the middleware (Edge) and on the server: only Web Crypto, no Node modules.
 *
 * - The code itself is not in the repository: only its SHA-256. With ~79 random bits it can't
 *   be found from the hash or by guessing, and the form is rate limited on top.
 * - The pass is "<expiry>.<HMAC-SHA256>" keyed with NEXTAUTH_SECRET and bound to the code's
 *   hash: it can't be forged or extended, and changing the code voids every pass at once.
 * - On by default on Vercel (production and previews), off on `next dev`. SITE_GATE=off opens
 *   the site at launch; SITE_GATE_CODE_HASH changes the code without touching the code.
 */

export const GATE_COOKIE = "orbitly_gate";
export const GATE_PAGE = "/accesso";
/** A device stays in for 30 days, then asks for the code again. */
export const PASS_MAX_AGE = 30 * 24 * 60 * 60;

/** SHA-256 of the default code, normalized (capitals and digits, no dashes). */
const DEFAULT_CODE_HASH = "558db8c0bf54847c0aa5b5c452a0c8825773ca5bde8d649b3a4481c571b645df";

export function gateEnabled() {
  const setting = process.env.SITE_GATE?.trim().toLowerCase();
  if (setting === "off") return false;
  if (setting === "on") return true;
  return Boolean(process.env.VERCEL_ENV);
}

/** "abcd-efgh 2345" and "ABCDEFGH2345" are the same code. */
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

const codeHash = () => (process.env.SITE_GATE_CODE_HASH || DEFAULT_CODE_HASH).trim().toLowerCase();

function secret() {
  const value = process.env.NEXTAUTH_SECRET;
  // Without a secret no pass could be trusted: the gate stays shut rather than open.
  if (!value) throw new Error("[gate] NEXTAUTH_SECRET mancante");
  return value;
}

const encoder = new TextEncoder();
const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(text: string) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

async function hmacHex(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`orbitly-gate:${secret()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/** Compares without stopping at the first difference, so timing reveals nothing. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function codeMatches(input: string) {
  const code = normalizeCode(input);
  if (!code || code.length > 64) return false;
  return safeEqual(await sha256Hex(code), codeHash());
}

export async function issuePass(now = Date.now()) {
  const expires = Math.floor(now / 1000) + PASS_MAX_AGE;
  return `${expires}.${await hmacHex(`${expires}.${codeHash()}`)}`;
}

export async function validPass(value: string | undefined, now = Date.now()) {
  if (!value) return false;
  const match = /^(\d{10})\.([0-9a-f]{64})$/.exec(value);
  if (!match) return false;
  const expires = Number(match[1]);
  if (expires * 1000 <= now || expires * 1000 > now + (PASS_MAX_AGE + 60) * 1000) return false;
  return safeEqual(match[2], await hmacHex(`${expires}.${codeHash()}`));
}

/**
 * What works without the code: the gate itself and what its page needs, and what machines
 * call with their own secret (the Stripe webhook is signed, the cron jobs carry CRON_SECRET).
 * The emails' pictures stay open, or mail clients would show them broken.
 */
const OPEN = [
  /^\/accesso\/?$/,
  /^\/api\/accesso$/,
  /^\/api\/billing\/webhook$/,
  /^\/api\/cron\/[a-z0-9-]+$/,
  /^\/email-assets\/[a-z0-9-]+\.png$/,
  /^\/_next\/static\//,
  /^\/(?:icon|apple-icon)$/,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
];

export const isOpenPath = (pathname: string) => OPEN.some((re) => re.test(pathname));

/** Where to go after the code: only a path of this site, never another one. */
export function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost" || url.pathname.startsWith(GATE_PAGE)) return "/";
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}
