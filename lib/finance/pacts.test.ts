import { describe, expect, it } from "vitest";
import { linkExpiry, pactPeriod, pactStatus, trackRecord } from "./pacts";

describe("the period", () => {
  it("runs from today to the end of the month, or over the whole next month", () => {
    expect(pactPeriod("now", "2026-10-08")).toEqual({ from: "2026-10-08", to: "2026-10-31" });
    expect(pactPeriod("next-month", "2026-10-08")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(pactPeriod("next-month", "2026-12-20")).toEqual({
      from: "2027-01-01",
      to: "2027-01-31",
    });
    expect(pactPeriod("now", "2028-02-10").to).toBe("2028-02-29");
  });

  it("keeps the referee's link a month after the end", () => {
    expect(linkExpiry("2026-11-30")).toBe("2026-12-30");
  });
});

describe("where a pact stands", () => {
  const pact = { limit: 150, from: "2026-11-01", to: "2026-11-30" };

  it("is upcoming before it starts", () => {
    expect(pactStatus({ ...pact, spent: 0, today: "2026-10-20" })).toEqual({
      state: "upcoming",
      used: 0,
      elapsed: 0,
      daysLeft: 30,
      projected: null,
      over: 0,
    });
  });

  it("is active during the month, with the pace from the third day", () => {
    expect(pactStatus({ ...pact, spent: 40, today: "2026-11-02" }).projected).toBeNull();
    const s = pactStatus({ ...pact, spent: 60, today: "2026-11-10" });
    expect(s).toMatchObject({ state: "active", used: 0.4, daysLeft: 21, projected: 180 });
    expect(s.elapsed).toBeCloseTo(1 / 3, 6);
    expect(pactStatus({ ...pact, spent: 60, today: "2026-11-30" }).daysLeft).toBe(1);
  });

  it("is lost as soon as the limit is passed", () => {
    expect(pactStatus({ ...pact, spent: 162.4, today: "2026-11-12" })).toMatchObject({
      state: "lost",
      over: 12.4,
      daysLeft: 19,
    });
  });

  it("is won or lost after the end", () => {
    expect(pactStatus({ ...pact, spent: 150, today: "2026-12-01" })).toMatchObject({
      state: "won",
      used: 1,
      elapsed: 1,
      daysLeft: 0,
      projected: null,
    });
    expect(pactStatus({ ...pact, spent: 151, today: "2026-12-01" }).state).toBe("lost");
  });
});

describe("track record", () => {
  it("counts the pacts kept among those that are over", () => {
    expect(trackRecord(["won", "lost", "active", "won", "upcoming"])).toEqual({
      kept: 2,
      total: 3,
    });
  });
});
