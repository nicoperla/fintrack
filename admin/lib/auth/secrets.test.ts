import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminPasswordProblem,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  open,
  seal,
} from "./secrets";
import { base32Encode, totpCode, totpStep, verifyTotp } from "./totp";

beforeEach(() => vi.stubEnv("ADMIN_SECRET", "s".repeat(40)));
afterEach(() => vi.unstubAllEnvs());

describe("2FA secret encryption", () => {
  it("opens what it sealed, and nothing sealed with another ADMIN_SECRET", () => {
    const box = seal("JBSWY3DPEHPK3PXP");
    expect(box).not.toContain("JBSWY3DPEHPK3PXP");
    expect(open(box)).toBe("JBSWY3DPEHPK3PXP");
    vi.stubEnv("ADMIN_SECRET", "t".repeat(40));
    expect(open(box)).toBeNull();
  });

  it("refuses to run without a long enough ADMIN_SECRET", () => {
    vi.stubEnv("ADMIN_SECRET", "short");
    expect(() => seal("x")).toThrow(/ADMIN_SECRET/);
  });
});

describe("TOTP (same as FinTrack)", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [2000000000, "279037"],
  ])("matches the RFC 6238 vector at %i s", (seconds, code) => {
    expect(totpCode(secret, totpStep(seconds * 1000))).toBe(code);
  });

  it("never accepts the same code twice", () => {
    const now = 1111111111 * 1000;
    const step = totpStep(now);
    const code = totpCode(secret, step);
    expect(verifyTotp(secret, code, { now })).toBe(step);
    expect(verifyTotp(secret, code, { now, lastStep: step })).toBeNull();
  });
});

describe("recovery codes", () => {
  it("are ten, different, and read however they're typed", () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    const [first] = codes;
    expect(normalizeRecoveryCode(first.toUpperCase().replace("-", " "))).toBe(
      first.replace("-", ""),
    );
    expect(hashRecoveryCode("abcdefghjk")).toMatch(/^[0-9a-f]{64}$/);
    expect(normalizeRecoveryCode("123456")).toBeNull();
  });
});

describe("admin password rules", () => {
  it("wants 12 characters, not the email, not repetitive", () => {
    expect(adminPasswordProblem("corta", "anna@example.com")).toMatch(/12/);
    expect(adminPasswordProblem("annarossi-2026!", "annarossi@example.com")).toMatch(/email/);
    expect(adminPasswordProblem("abababababab", "x@example.com")).toMatch(/prevedibile/);
    expect(adminPasswordProblem("lampada verde sul molo", "x@example.com")).toBeNull();
  });
});
