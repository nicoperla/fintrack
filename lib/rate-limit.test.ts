import { describe, expect, it } from "vitest";
import { clientIp, formatRetryAfter } from "./rate-limit";

describe("clientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp({ "x-forwarded-for": "5.6.7.8" })).toBe("5.6.7.8");
    expect(clientIp({})).toBe("unknown");
  });
});

describe("formatRetryAfter", () => {
  it("rounds to what a person cares about", () => {
    expect(formatRetryAfter(30)).toBe("un minuto");
    expect(formatRetryAfter(600)).toBe("10 minuti");
    expect(formatRetryAfter(3500)).toBe("59 minuti");
    expect(formatRetryAfter(3700)).toBe("un'ora");
    expect(formatRetryAfter(5 * 3600)).toBe("5 ore");
  });
});
