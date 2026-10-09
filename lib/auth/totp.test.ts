import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  groupSecret,
  normalizeTotp,
  otpauthUri,
  totpCode,
  totpStep,
  verifyTotp,
} from "./totp";

// RFC 6238, appendix B: the SHA-1 seed is the ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("base32", () => {
  it("encodes as RFC 4648 does, without padding", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("decodes back, ignoring case, spaces and dashes", () => {
    expect(base32Decode("mzxw 6ytb-oi").toString()).toBe("foobar");
    const secret = generateTotpSecret();
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it("refuses characters outside the alphabet", () => {
    expect(() => base32Decode("ABC1")).toThrow();
  });
});

describe("totpCode", () => {
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ])("matches the RFC 6238 test vector at %i s", (seconds, code) => {
    expect(totpCode(RFC_SECRET, totpStep(seconds * 1000))).toBe(code);
  });

  it("makes 160-bit secrets", () => {
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe("verifyTotp", () => {
  const now = 1111111111 * 1000;
  const step = totpStep(now);

  it("accepts the current code and one step either side", () => {
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), { now })).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), { now })).toBe(step + 1);
  });

  it("refuses codes further away in time", () => {
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 2), { now })).toBeNull();
  });

  it("never accepts the same code (or an older one) twice", () => {
    const code = totpCode(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, { now, lastStep: step })).toBeNull();
    expect(
      verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), { now, lastStep: step - 1 }),
    ).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, { now, lastStep: step - 1 })).toBe(step);
  });

  it("reads codes typed with a space or a dash, and refuses anything else", () => {
    const code = totpCode(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, { now })).toBe(step);
    expect(normalizeTotp("123-456")).toBe("123456");
    expect(normalizeTotp("12345")).toBeNull();
    expect(normalizeTotp("12345a")).toBeNull();
    expect(verifyTotp(RFC_SECRET, "", { now })).toBeNull();
  });
});

describe("otpauthUri", () => {
  it("names the issuer and the account, as the apps show them", () => {
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", "anna+casa@example.com");
    expect(uri).toBe(
      "otpauth://totp/FinTrack:anna%2Bcasa%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=FinTrack&algorithm=SHA1&digits=6&period=30",
    );
  });

  it("groups the secret by four for typing", () => {
    expect(groupSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });
});
