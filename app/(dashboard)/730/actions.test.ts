import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteHomeBonus,
  markSent,
  saveCu,
  saveHomeBonus,
  saveResult,
  saveSituation,
  setDocState,
  setExpenseDoc,
} from "./actions";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma } = vi.hoisted(() => ({
  prisma: {
    taxYear: { upsert: vi.fn(), findUnique: vi.fn() },
    transaction: { updateMany: vi.fn() },
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", currency: "EUR", user: { id: "user-1" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const answers = {
  work: "employee",
  moreEmployers: true,
  agent: true,
  home: "rent",
  spouse: false,
  children: 0,
  childrenShare: 100,
  parents: 0,
  childIncomeRisk: true,
  otherIncome: [],
  events: ["moved"],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-18T10:00:00Z"));
  prisma.user.findUniqueOrThrow.mockResolvedValue({ plan: "FREE", taxProfile: null });
});
afterEach(() => vi.useRealTimers());

const upserted = () => prisma.taxYear.upsert.mock.calls[0][0];

describe("saveSituation", () => {
  it("saves the person's answers for the year, tidied up", async () => {
    expect(await saveSituation(2026, answers)).toEqual({ ok: true });
    const call = upserted();
    expect(call.where).toEqual({ userId_year: { userId: "user-1", year: 2026 } });
    expect(call.create).toMatchObject({ userId: "user-1", year: 2026 });
    // Without children, the questions about them don't stick.
    expect(call.update.answers).toMatchObject({
      work: "employee",
      home: "rent",
      childrenShare: 50,
      childIncomeRisk: false,
      events: ["moved"],
      answeredAt: "2026-10-18T10:00:00.000Z",
    });
  });

  it("has nobody refunding in July for whoever doesn't work", async () => {
    await saveSituation(2026, { ...answers, work: "none", agent: true });
    expect(upserted().update.answers.agent).toBe(false);
  });

  it("refuses years it can't follow and incomplete answers", async () => {
    expect(await saveSituation(2030, answers)).toEqual({ ok: false, error: "Anno non valido." });
    const res = await saveSituation(2026, { ...answers, work: "" });
    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.work).toBeDefined();
    expect(prisma.taxYear.upsert).not.toHaveBeenCalled();
  });
});

describe("saveCu", () => {
  it("keeps the four figures of each CU", async () => {
    const res = await saveCu(2026, {
      entries: [
        { kind: "employee", income: "24.500", days: "365", withheld: "4.100,50", fixedTerm: false },
      ],
    });
    expect(res).toEqual({ ok: true });
    expect(upserted().update.cu).toEqual({
      entries: [{ kind: "employee", income: 24500, days: 365, withheld: 4100.5, fixedTerm: false }],
    });
  });

  it("names the field that's wrong, row by row", async () => {
    const res = await saveCu(2026, {
      entries: [
        { kind: "employee", income: "1000", days: "365", withheld: "0" },
        { kind: "employee", income: "1000", days: "400", withheld: "abc" },
      ],
    });
    expect(res.ok).toBe(false);
    expect(Object.keys(res.fieldErrors!)).toEqual(
      expect.arrayContaining(["entries.1.days", "entries.1.withheld"]),
    );
  });
});

describe("documents", () => {
  it("ticks a document, keeping the others", async () => {
    prisma.taxYear.findUnique.mockResolvedValue({ documents: { cu: "have" } });
    await setDocState(2026, "rent-contract", "have");
    expect(upserted().update.documents).toEqual({ cu: "have", "rent-contract": "have" });
  });

  it("goes back to 'to do' with null", async () => {
    prisma.taxYear.findUnique.mockResolvedValue({ documents: { cu: "have" } });
    await setDocState(2026, "cu", null);
    expect(upserted().update.documents).toEqual({});
  });

  it("marks the receipt of one of the user's own expenses", async () => {
    prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
    expect(await setExpenseDoc("tx-1", true)).toEqual({ ok: true });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: "tx-1", householdId: "space-1", userId: "user-1", type: "EXPENSE" },
      data: { deductionDoc: "have" },
    });
  });
});

describe("sending and after", () => {
  it("records the day and the channel", async () => {
    expect(await markSent(2025, { channel: "SELF", sentAt: "2026-05-20" })).toEqual({ ok: true });
    expect(upserted().update).toEqual({
      channel: "SELF",
      sentAt: new Date("2026-05-20T00:00:00Z"),
    });
  });

  it("refuses a day in the future or before the season", async () => {
    const future = await markSent(2025, { channel: "SELF", sentAt: "2026-12-01" });
    expect(future.fieldErrors?.sentAt).toBeDefined();
    const early = await markSent(2025, { channel: "CAF", sentAt: "2025-12-31" });
    expect(early.fieldErrors?.sentAt).toBeDefined();
  });

  it("saves a debt as a negative result, with the November advance", async () => {
    await saveResult(2025, { direction: "debt", amount: "150", secondAdvance: "90" });
    expect(upserted().update).toMatchObject({
      result: -150,
      secondAdvance: 90,
      refundReceivedAt: null,
    });
    const missing = await saveResult(2025, { direction: "refund", amount: "", secondAdvance: "" });
    expect(missing.fieldErrors?.amount).toBeDefined();
  });
});

describe("home bonuses", () => {
  it("adds one to the tax profile, keeping the rest", async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ taxProfile: { incomeBand: "oltre" } });
    const res = await saveHomeBonus(null, {
      kind: "ristrutturazione",
      year: "2025",
      amount: "12.000",
      rate: "50",
      label: "Bagno",
    });
    expect(res).toEqual({ ok: true });
    const saved = prisma.user.update.mock.calls[0][0].data.taxProfile;
    expect(saved.incomeBand).toBe("oltre");
    expect(saved.homeBonuses).toEqual([
      expect.objectContaining({
        kind: "ristrutturazione",
        year: 2025,
        amount: 12000,
        rate: 50,
        label: "Bagno",
      }),
    ]);
  });

  it("removes one by id", async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      taxProfile: {
        homeBonuses: [{ id: "hb1", kind: "mobili", year: 2025, amount: 3000, rate: 50, label: "" }],
      },
    });
    await deleteHomeBonus("hb1");
    expect(prisma.user.update.mock.calls[0][0].data.taxProfile.homeBonuses).toEqual([]);
  });
});
