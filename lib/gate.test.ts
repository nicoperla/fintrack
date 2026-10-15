import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  codeMatches,
  gateEnabled,
  isOpenPath,
  issuePass,
  normalizeCode,
  PASS_MAX_AGE,
  safeEqual,
  safeNext,
  validPass,
} from "./gate";
import { needsSession } from "./auth/public-paths";

// A test code: the real one is never in the repository, only its hash.
const CODE = "ABCD-EFGH-2345-JKMN";
const hashOf = (code: string) => createHash("sha256").update(normalizeCode(code)).digest("hex");

beforeEach(() => {
  vi.stubEnv("NEXTAUTH_SECRET", "segreto-di-prova");
  vi.stubEnv("SITE_GATE_CODE_HASH", hashOf(CODE));
});
afterEach(() => vi.unstubAllEnvs());

describe("gate code", () => {
  it("accepts the code however it's typed", async () => {
    expect(await codeMatches(CODE)).toBe(true);
    expect(await codeMatches("abcd efgh 2345 jkmn")).toBe(true);
    expect(await codeMatches(" abcdefgh2345jkmn ")).toBe(true);
  });

  it("refuses anything else", async () => {
    expect(await codeMatches("ABCD-EFGH-2345-JKMP")).toBe(false);
    expect(await codeMatches("")).toBe(false);
    expect(await codeMatches("---")).toBe(false);
    expect(await codeMatches("A".repeat(500))).toBe(false);
  });

  it("compares strings without shortcuts", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("gate pass", () => {
  const now = Date.UTC(2026, 9, 15, 12);

  it("is valid for 30 days, then not", async () => {
    const pass = await issuePass(now);
    expect(await validPass(pass, now)).toBe(true);
    expect(await validPass(pass, now + (PASS_MAX_AGE - 60) * 1000)).toBe(true);
    expect(await validPass(pass, now + (PASS_MAX_AGE + 1) * 1000)).toBe(false);
  });

  it("can't be forged, extended or tampered with", async () => {
    const pass = await issuePass(now);
    const [expires, signature] = pass.split(".");
    const later = String(Number(expires) + 3600);
    expect(await validPass(`${later}.${signature}`, now)).toBe(false);
    expect(await validPass(`${expires}.${"0".repeat(64)}`, now)).toBe(false);
    expect(await validPass(`${expires}.${signature.slice(0, -1)}x`, now)).toBe(false);
    expect(await validPass(undefined, now)).toBe(false);
    expect(await validPass("ciao", now)).toBe(false);
    // A pass for ten years ahead, even if correctly signed, is refused.
    vi.useFakeTimers();
    vi.setSystemTime(now + 10 * 365 * 24 * 3600 * 1000);
    const farFuture = await issuePass();
    vi.useRealTimers();
    expect(await validPass(farFuture, now)).toBe(false);
  });

  it("stops working when the code or the server secret changes", async () => {
    const pass = await issuePass(now);
    vi.stubEnv("SITE_GATE_CODE_HASH", hashOf("ZZZZ-ZZZZ-ZZZZ-ZZZZ"));
    expect(await validPass(pass, now)).toBe(false);
    vi.stubEnv("SITE_GATE_CODE_HASH", hashOf(CODE));
    vi.stubEnv("NEXTAUTH_SECRET", "un-altro-segreto");
    expect(await validPass(pass, now)).toBe(false);
  });

  it("refuses to work without a server secret", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");
    await expect(issuePass(now)).rejects.toThrow();
  });
});

describe("gate switch", () => {
  it("is on online and off on next dev, unless told otherwise", () => {
    vi.stubEnv("SITE_GATE", "");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(gateEnabled()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(gateEnabled()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "");
    expect(gateEnabled()).toBe(false);
    vi.stubEnv("SITE_GATE", "on");
    expect(gateEnabled()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SITE_GATE", "off");
    expect(gateEnabled()).toBe(false);
  });
});

describe("gate paths", () => {
  it("leaves open only the gate and what machines call with their own secret", () => {
    for (const path of [
      "/accesso",
      "/api/accesso",
      "/api/billing/webhook",
      "/api/cron/weekly-digest",
      "/email-assets/hero-violet.png",
      "/_next/static/chunks/main.js",
      "/icon",
      "/robots.txt",
    ]) {
      expect(isOpenPath(path), path).toBe(true);
    }
  });

  it("closes everything else, landing page and pictures included", () => {
    for (const path of [
      "/",
      "/login",
      "/register",
      "/dashboard",
      "/api/auth/session",
      "/api/transactions",
      "/landing/video-desktop.mp4",
      "/sw.js",
      "/manifest.webmanifest",
      "/_next/image",
      "/accesso-falso",
      "/api/accesso/altro",
      "/email-assets/../dashboard",
      "/api/cron/../transactions",
    ]) {
      expect(isOpenPath(path), path).toBe(false);
    }
  });

  it("sends back only to pages of this site", () => {
    expect(safeNext("/dashboard?x=1")).toBe("/dashboard?x=1");
    expect(safeNext("https://evil.example/")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/accesso")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("needsSession", () => {
  it("protects the app's pages and leaves the public ones open", () => {
    for (const path of ["/dashboard", "/transactions", "/settings", "/api/transactions"]) {
      expect(needsSession(path), path).toBe(true);
    }
    for (const path of ["/", "/login", "/accesso", "/api/accesso", "/privacy", "/icon"]) {
      expect(needsSession(path), path).toBe(false);
    }
  });
});
