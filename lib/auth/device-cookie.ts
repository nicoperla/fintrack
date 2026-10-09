import { getAppUrl } from "@/lib/app-url";

/*
 * The device cookie: a random id that tells a known browser from a new one, and ties a login
 * ticket to the browser that asked for it. No Node APIs here: the middleware sets it too.
 */

const secure = () => getAppUrl().startsWith("https://");

/** "__Host-": only over HTTPS, only for this exact host, never readable by scripts. */
export const deviceCookieName = () => (secure() ? "__Host-ft-device" : "ft-device");

export function deviceCookieOptions() {
  return {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax" as const,
    path: "/",
    // The longest browsers keep a cookie.
    maxAge: 400 * 24 * 60 * 60,
  };
}

/** 256 random bits as base64url (43 characters), with Web Crypto so it works on the edge too. */
export function newDeviceId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const isDeviceId = (value: string | undefined): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
