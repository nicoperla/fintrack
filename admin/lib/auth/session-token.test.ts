import { describe, expect, it } from "vitest";
import {
  fromBase64Url,
  signSession,
  toBase64Url,
  verifySession,
  SESSION_HOURS,
} from "./session-token";

const SECRET = "x".repeat(48);
const NOW = Date.parse("2026-10-09T10:00:00Z");

describe("admin session token", () => {
  it("round-trips the admin and the session version", async () => {
    const token = await signSession(SECRET, "admin-1", 3, NOW);
    const payload = await verifySession(SECRET, token, NOW + 1000);
    expect(payload).toMatchObject({ a: "admin-1", v: 3 });
    expect(payload!.exp - payload!.iat).toBe(SESSION_HOURS * 3600);
  });

  it("expires after the session length", async () => {
    const token = await signSession(SECRET, "admin-1", 0, NOW);
    expect(
      await verifySession(SECRET, token, NOW + SESSION_HOURS * 3600 * 1000 - 1000),
    ).not.toBeNull();
    expect(await verifySession(SECRET, token, NOW + SESSION_HOURS * 3600 * 1000)).toBeNull();
  });

  it("refuses a token signed with another secret", async () => {
    const token = await signSession(SECRET, "admin-1", 0, NOW);
    expect(await verifySession("y".repeat(48), token, NOW)).toBeNull();
  });

  it("refuses a token whose payload was changed", async () => {
    const token = await signSession(SECRET, "admin-1", 0, NOW);
    const [, signature] = token.split(".");
    const forged = toBase64Url(
      new TextEncoder().encode(JSON.stringify({ a: "admin-2", v: 0, iat: 0, exp: 9e9 })),
    );
    expect(await verifySession(SECRET, `${forged}.${signature}`, NOW)).toBeNull();
  });

  it("refuses garbage", async () => {
    for (const token of [undefined, "", "abc", "a.b.c", "a.b", "x".repeat(2000)]) {
      expect(await verifySession(SECRET, token, NOW)).toBeNull();
    }
  });

  it("encodes base64url both ways", () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 128, 1]);
    expect(toBase64Url(bytes)).not.toMatch(/[+/=]/);
    expect([...fromBase64Url(toBase64Url(bytes))]).toEqual([...bytes]);
  });
});
