import { createHash } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPwnedPassword, passwordProblem } from "./password-policy";

const suffixOf = (password: string) =>
  createHash("sha1").update(password).digest("hex").toUpperCase().slice(5);

function stubRange(body: string, ok = true) {
  const fetch = vi.fn().mockResolvedValue({ ok, text: async () => body });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("isPwnedPassword", () => {
  it("sends only the first 5 characters of the hash, with padding", async () => {
    const fetch = stubRange("");
    await isPwnedPassword("una password qualsiasi");
    const [url, init] = fetch.mock.calls[0];
    const sha1 = createHash("sha1").update("una password qualsiasi").digest("hex").toUpperCase();
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`);
    expect(url).not.toContain(sha1.slice(5));
    expect(init.headers).toEqual({ "Add-Padding": "true" });
  });

  it("finds a leaked password in the list", async () => {
    stubRange(`0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n${suffixOf("password123")}:251682\r\n`);
    expect(await isPwnedPassword("password123")).toBe(true);
  });

  it("ignores padding lines (count 0) and other hashes", async () => {
    stubRange(`${suffixOf("password123")}:0\r\n0018A45C4D1DEF81644B54AB7F969B88D65:3`);
    expect(await isPwnedPassword("password123")).toBe(false);
  });

  it("accepts the password when the service doesn't answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await isPwnedPassword("password123")).toBe(false);
    stubRange("", false);
    expect(await isPwnedPassword("password123")).toBe(false);
  });
});

describe("passwordProblem", () => {
  it("refuses the email, the name and the app's name", async () => {
    stubRange("");
    expect(await passwordProblem("anna.rossi2026", { email: "anna.rossi@example.com" })).toMatch(
      /email/,
    );
    expect(await passwordProblem("FinTrack2026!")).toMatch(/email o il nome/);
    expect(await passwordProblem("Giuseppe-1990", { name: "Giuseppe Verdi" })).toMatch(/nome/);
  });

  it("refuses passwords with too few different characters", async () => {
    stubRange("");
    expect(await passwordProblem("aaaaaaaaaaaa")).toMatch(/prevedibile/);
    expect(await passwordProblem("abababab12")).toMatch(/prevedibile/);
  });

  it("refuses leaked passwords and accepts a good one", async () => {
    stubRange(`${suffixOf("qwertyuiop1")}:1200`);
    expect(await passwordProblem("qwertyuiop1")).toMatch(/furto di dati/);
    expect(await passwordProblem("treno lento sul lago")).toBeNull();
  });
});
