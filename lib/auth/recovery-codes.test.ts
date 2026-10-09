import { describe, expect, it } from "vitest";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from "./recovery-codes";

describe("recovery codes", () => {
  it("makes ten different codes, easy to read aloud", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) expect(code).toMatch(/^[a-hjkmnp-z2-9]{5}-[a-hjkmnp-z2-9]{5}$/);
  });

  it("reads them however they're typed", () => {
    expect(normalizeRecoveryCode(" K7M2P-X9QRT ")).toBe("k7m2px9qrt");
    expect(normalizeRecoveryCode("k7m2p x9qrt")).toBe("k7m2px9qrt");
  });

  it("refuses what can't be a code", () => {
    expect(normalizeRecoveryCode("123456")).toBeNull();
    expect(normalizeRecoveryCode("k7m2p-x9qr0")).toBeNull(); // 0 isn't in the alphabet
    expect(normalizeRecoveryCode("k7m2p-x9qrtt")).toBeNull();
  });

  it("stores a hash that doesn't contain the code", () => {
    const hash = hashRecoveryCode("k7m2px9qrt");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashRecoveryCode("k7m2px9qrt"));
    expect(hash).not.toBe(hashRecoveryCode("k7m2px9qrs"));
  });
});
