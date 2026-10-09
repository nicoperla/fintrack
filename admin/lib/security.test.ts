import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
const { classify } = await import("./security");

const NOW = Date.parse("2026-10-09T10:00:00Z");
const row = (key: string, count: number, minutesAgo: number) => ({
  key,
  count,
  window_start: new Date(NOW - minutesAgo * 60_000),
});

describe("classify", () => {
  it("reads FinTrack and panel counters with their limits", () => {
    expect(classify(row("login:email:anna@example.com", 9, 5), NOW)).toMatchObject({
      label: "Accesso",
      who: "anna@example.com",
      whoKind: "email",
      blocked: true,
      limit: 8,
    });
    expect(classify(row("2fa:user-1", 3, 5), NOW)).toMatchObject({
      userId: "user-1",
      blocked: false,
    });
    expect(classify(row("2fa-day:user-1", 21, 600), NOW)).toMatchObject({
      label: "Codici 2FA (giorno)",
      blocked: true,
    });
    expect(classify(row("admin-login:ip:203.0.113.7", 11, 1), NOW)).toMatchObject({
      label: "Accesso al pannello",
      whoKind: "ip",
      blocked: true,
    });
  });

  it("ignores counters whose window is over, and unknown ones", () => {
    expect(classify(row("login:email:anna@example.com", 50, 16), NOW)).toBeNull();
    expect(classify(row("coach:daily:user-1", 99, 1), NOW)).toBeNull();
  });
});
