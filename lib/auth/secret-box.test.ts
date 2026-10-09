import { afterEach, describe, expect, it, vi } from "vitest";
import { open, seal } from "./secret-box";

afterEach(() => vi.unstubAllEnvs());

describe("secret box", () => {
  it("gives back what was sealed, never storing it in clear", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    const box = seal("JBSWY3DPEHPK3PXP");
    expect(box).not.toContain("JBSWY3DPEHPK3PXP");
    expect(box.startsWith("v1.")).toBe(true);
    expect(open(box)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("seals the same text differently each time", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    expect(seal("abc")).not.toBe(seal("abc"));
  });

  it("returns null when the box was changed", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    const [v, iv, tag, data] = seal("JBSWY3DPEHPK3PXP").split(".");
    const flipped = (data[0] === "A" ? "B" : "A") + data.slice(1);
    expect(open([v, iv, tag, flipped].join("."))).toBeNull();
    expect(open("v2.x.y.z")).toBeNull();
    expect(open("garbage")).toBeNull();
  });

  it("returns null with another key, and prefers TWO_FACTOR_KEY", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "first");
    const box = seal("secret");
    vi.stubEnv("NEXTAUTH_SECRET", "second");
    expect(open(box)).toBeNull();

    vi.stubEnv("TWO_FACTOR_KEY", "dedicated");
    const dedicated = seal("secret");
    vi.stubEnv("NEXTAUTH_SECRET", "rotated");
    expect(open(dedicated)).toBe("secret");
  });
});
