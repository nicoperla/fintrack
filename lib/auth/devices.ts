import { createHash } from "crypto";
import { deviceCookieName, isDeviceId } from "@/lib/auth/device-cookie";

/*
 * Which browser is signing in, from its device cookie (lib/auth/device-cookie.ts) and headers:
 * a known browser or a new one (that gets an email), and a name to show for it.
 */

export {
  deviceCookieName,
  deviceCookieOptions,
  isDeviceId,
  newDeviceId,
} from "@/lib/auth/device-cookie";

export const hashDeviceId = (id: string) =>
  createHash("sha256").update(`device:${id}`).digest("hex");

/** The device cookie from a raw Cookie header (NextAuth hands authorize() the plain headers). */
export function deviceIdFromCookieHeader(header: string | undefined) {
  const name = deviceCookieName();
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      const value = rest.join("=");
      return isDeviceId(value) ? value : null;
    }
  }
  return null;
}

const BROWSERS: [RegExp, string][] = [
  [/EdgA?\/|Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "Mac"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

/** "Chrome su Windows", "Safari su iPhone"; "Browser sconosciuto" when it can't tell. */
export function describeDevice(userAgent: string | null | undefined) {
  const ua = userAgent ?? "";
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  if (browser && system) return `${browser} su ${system}`;
  return browser ?? system ?? "Browser sconosciuto";
}

/** "Milano, IT" from Vercel's geolocation headers; null elsewhere (local, other hosts). */
export function placeFromHeaders(headers: Pick<Headers, "get">) {
  const country = headers.get("x-vercel-ip-country");
  if (!country || !/^[A-Z]{2}$/.test(country)) return null;
  let city = headers.get("x-vercel-ip-city");
  try {
    city = city ? decodeURIComponent(city) : null;
  } catch {
    city = null;
  }
  // The city is printed in emails: keep only what a city name can contain.
  const safeCity = city
    ?.replace(/[^A-Za-zÀ-ɏ\s'.-]/g, "")
    .trim()
    .slice(0, 60);
  return safeCity ? `${safeCity}, ${country}` : country;
}
