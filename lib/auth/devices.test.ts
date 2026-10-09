import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deviceCookieName,
  deviceIdFromCookieHeader,
  describeDevice,
  newDeviceId,
  placeFromHeaders,
} from "./devices";

afterEach(() => vi.unstubAllEnvs());

describe("describeDevice", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      "Chrome su Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
      "Edge su Windows",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari su iPhone",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
      "Samsung Internet su Android",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:130.0) Gecko/20100101 Firefox/130.0",
      "Firefox su Mac",
    ],
    ["curl/8.4.0", "Browser sconosciuto"],
    [null, "Browser sconosciuto"],
  ])("%s → %s", (ua, label) => {
    expect(describeDevice(ua)).toBe(label);
  });
});

describe("placeFromHeaders", () => {
  const headers = (values: Record<string, string>) => new Headers(values);

  it("reads Vercel's city and country", () => {
    expect(
      placeFromHeaders(headers({ "x-vercel-ip-country": "IT", "x-vercel-ip-city": "Forl%C3%AC" })),
    ).toBe("Forlì, IT");
  });

  it("keeps the country alone when the city is missing or odd", () => {
    expect(placeFromHeaders(headers({ "x-vercel-ip-country": "IT" }))).toBe("IT");
    expect(
      placeFromHeaders(
        headers({ "x-vercel-ip-country": "IT", "x-vercel-ip-city": "%3Cscript%3E" }),
      ),
    ).toBe("script, IT");
    expect(
      placeFromHeaders(headers({ "x-vercel-ip-country": "IT", "x-vercel-ip-city": "%E0%A4%A" })),
    ).toBe("IT");
  });

  it("is null outside Vercel", () => {
    expect(placeFromHeaders(headers({}))).toBeNull();
    expect(placeFromHeaders(headers({ "x-vercel-ip-country": "<b>" }))).toBeNull();
  });
});

describe("device cookie", () => {
  it("is __Host- only over HTTPS", () => {
    vi.stubEnv("NEXTAUTH_URL", "https://fintrack.example");
    expect(deviceCookieName()).toBe("__Host-ft-device");
    vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000");
    expect(deviceCookieName()).toBe("ft-device");
  });

  it("is read from the raw Cookie header, only when well formed", () => {
    vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000");
    const id = newDeviceId();
    expect(deviceIdFromCookieHeader(`theme=dark; ft-device=${id}; other=1`)).toBe(id);
    expect(deviceIdFromCookieHeader("ft-device=short")).toBeNull();
    expect(deviceIdFromCookieHeader(undefined)).toBeNull();
  });
});
