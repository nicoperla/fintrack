import { describe, expect, it } from "vitest";
import {
  EMPTY_TAX_PROFILE,
  compareWithPrecompiled,
  fringeStatus,
  readTaxProfile,
  refundFor,
  rentDeduction,
  welfareDeadline,
  type TaxProfile,
} from "./rights";

const profile = (patch: {
  incomeBand?: TaxProfile["incomeBand"];
  birthYear?: number | null;
  rent?: Partial<TaxProfile["rent"]>;
}): TaxProfile => ({
  ...EMPTY_TAX_PROFILE,
  incomeBand: patch.incomeBand ?? "fino-15k",
  birthYear: patch.birthYear ?? null,
  rent: { ...EMPTY_TAX_PROFILE.rent, contract: "libero", ...patch.rent },
});

const rent = (p: TaxProfile, rentPaid = 9000, months = 12) =>
  rentDeduction({ year: 2026, profile: p, rentPaid, months });

describe("rentDeduction", () => {
  it("asks for what it needs", () => {
    expect(rent(profile({ rent: { contract: null } }))).toMatchObject({ amount: 0 });
    expect(rent({ ...profile({}), incomeBand: null })).toMatchObject({ amount: 0 });
    expect(rent(profile({ incomeBand: "oltre" }))).toMatchObject({
      amount: 0,
      reason: expect.stringContaining("30.987,41"),
    });
  });

  it("gives the fixed amounts of the free and the agreed rent", () => {
    expect(rent(profile({}))).toMatchObject({ amount: 300, kind: "libero", code: 1, months: 12 });
    expect(rent(profile({ incomeBand: "fino-31k" }))).toMatchObject({ amount: 150 });
    expect(rent(profile({ rent: { contract: "concordato" } }))).toMatchObject({
      amount: 495.8,
      code: 2,
    });
    expect(
      rent(profile({ incomeBand: "fino-31k", rent: { contract: "concordato" } })),
    ).toMatchObject({ amount: 247.9 });
  });

  it("counts only the months rented, or the whole year when none is recorded", () => {
    expect(rent(profile({}), 4500, 6)).toMatchObject({ amount: 150, months: 6 });
    expect(rent(profile({}), 0, 0)).toMatchObject({ amount: 300, months: 12 });
  });

  it("picks the transfer for work when it's worth more", () => {
    expect(rent(profile({ rent: { transferred: true } }))).toMatchObject({
      amount: 991.6,
      kind: "transferred",
      code: 3,
    });
    expect(rent(profile({ incomeBand: "fino-31k", rent: { transferred: true } }))).toMatchObject({
      amount: 495.8,
    });
  });

  it("gives the young 20% of the rent, between 991,60 and 2.000 €", () => {
    const young = profile({ birthYear: 2000, rent: { since: 2024 } });
    expect(rent(young, 9000)).toMatchObject({ amount: 1800, kind: "young", code: 4 });
    expect(rent(young, 12000)).toMatchObject({ amount: 2000 });
    expect(rent(young, 3600)).toMatchObject({ amount: 991.6 });
  });

  it("only in the first four years, under 31 and with a low income", () => {
    expect(rent(profile({ birthYear: 2000, rent: { since: 2022 } }))).toMatchObject({
      kind: "libero",
    });
    expect(rent(profile({ birthYear: 1993, rent: { since: 2025 } }))).toMatchObject({
      kind: "libero",
    });
    expect(
      rent(profile({ incomeBand: "fino-31k", birthYear: 2000, rent: { since: 2025 } })),
    ).toMatchObject({ kind: "libero" });
  });
});

describe("refundFor", () => {
  it("applies franchigia and limits", () => {
    expect(refundFor("sanitarie", 1000, 0)).toBe(165.47);
    expect(refundFor("sanitarie", 100, 0)).toBe(0);
    // 210 € per child.
    expect(refundFor("sport", 500, 2)).toBe(79.8);
  });
});

describe("compareWithPrecompiled", () => {
  it("adds what FinTrack saw and the precompilato lacks, and the rent", () => {
    const result = compareWithPrecompiled({
      fintrack: { sanitarie: 1000, sport: 300, veterinarie: 100 },
      precompiled: { sanitarie: 800, veterinarie: 400 },
      children: 1,
      rent: { amount: 300, inPrecompiled: false },
    });
    const row = (type: string) => result.rows.find((r) => r.type === type)!;
    expect(row("sanitarie")).toMatchObject({ missing: 200, extraRefund: 38 });
    expect(row("sport")).toMatchObject({ missing: 300, extraRefund: 39.9 });
    // The precompilato has more: nothing to add.
    expect(row("veterinarie")).toMatchObject({ missing: 0, extraRefund: 0 });
    expect(result).toMatchObject({ rentExtra: 300, extraRefund: 377.9, missingTotal: 500 });
  });

  it("doesn't count the rent twice", () => {
    const result = compareWithPrecompiled({
      fintrack: {},
      precompiled: {},
      children: 0,
      rent: { amount: 300, inPrecompiled: true },
    });
    expect(result.extraRefund).toBe(0);
  });
});

describe("company welfare", () => {
  const welfare = (patch: Partial<TaxProfile["welfare"]>) => ({
    ...EMPTY_TAX_PROFILE.welfare,
    ...patch,
  });

  it("checks the fringe benefits against this year's limit", () => {
    expect(fringeStatus(welfare({ fringe: 950, fringeYear: 2026 }), 0, 2026)).toEqual({
      limit: 1000,
      used: 950,
      left: 50,
      state: "near",
    });
    expect(fringeStatus(welfare({ fringe: 1200, fringeYear: 2026 }), 0, 2026).state).toBe("over");
    expect(fringeStatus(welfare({ fringe: 1200, fringeYear: 2026 }), 1, 2026)).toMatchObject({
      limit: 2000,
      state: "ok",
    });
    // Last year's figure is forgotten.
    expect(fringeStatus(welfare({ fringe: 1200, fringeYear: 2025 }), 0, 2026).state).toBe(
      "unknown",
    );
  });

  it("counts the days left to use the credit", () => {
    const today = "2026-10-07";
    expect(welfareDeadline(welfare({ balance: 350, expiresOn: "2026-10-31" }), today)).toEqual({
      balance: 350,
      expiresOn: "2026-10-31",
      days: 24,
      state: "soon",
    });
    expect(welfareDeadline(welfare({ balance: 350, expiresOn: "2026-12-31" }), today)?.state).toBe(
      "ok",
    );
    expect(welfareDeadline(welfare({ balance: 350, expiresOn: "2026-09-30" }), today)?.state).toBe(
      "expired",
    );
    expect(welfareDeadline(welfare({ balance: 0, expiresOn: "2026-12-31" }), today)).toBeNull();
  });
});

describe("readTaxProfile", () => {
  it("keeps what's valid and drops the rest", () => {
    expect(readTaxProfile(null)).toEqual(EMPTY_TAX_PROFILE);
    expect(
      readTaxProfile({
        incomeBand: "fino-31k",
        birthYear: 1990,
        rent: { contract: "boh", since: 2024, transferred: true },
        welfare: { balance: 350, expiresOn: "31/12/2026", fringe: 600, fringeYear: 2026 },
      }),
    ).toEqual({
      incomeBand: "fino-31k",
      birthYear: 1990,
      rent: { contract: null, since: 2024, transferred: true },
      welfare: { balance: 350, expiresOn: null, fringe: 600, fringeYear: 2026 },
    });
  });
});
