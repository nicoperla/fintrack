import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDecision, deleteDecision, markTalkHeld, setDecisionDone, undoTalk } from "./actions";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma } = vi.hoisted(() => ({
  prisma: {
    householdMember: { count: vi.fn(), findUnique: vi.fn() },
    moneyDecision: {
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    moneyTalk: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", currency: "EUR", user: { id: "user-1" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T10:00:00Z"));
  prisma.householdMember.count.mockResolvedValue(2);
  prisma.householdMember.findUnique.mockResolvedValue({ userId: "user-2" });
  prisma.moneyDecision.count.mockResolvedValue(0);
  prisma.moneyDecision.updateMany.mockResolvedValue({ count: 1 });
  prisma.moneyDecision.deleteMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.useRealTimers());

describe("addDecision", () => {
  const decision = {
    month: "2026-09",
    topic: "Budget «Ristoranti»",
    text: "  Una cena fuori a settimana, non di più  ",
    ownerId: "user-2",
    dueOn: "2026-10-31",
  };

  it("writes the decision in the space's log", async () => {
    expect(await addDecision(decision)).toEqual({ ok: true });
    expect(prisma.householdMember.findUnique).toHaveBeenCalledWith({
      where: { householdId_userId: { householdId: "space-1", userId: "user-2" } },
      select: { userId: true },
    });
    expect(prisma.moneyDecision.create).toHaveBeenCalledWith({
      data: {
        householdId: "space-1",
        month: day("2026-09-01"),
        topic: "Budget «Ristoranti»",
        text: "Una cena fuori a settimana, non di più",
        ownerId: "user-2",
        dueOn: day("2026-10-31"),
      },
    });
  });

  it("takes a decision for everyone, with no topic and no date", async () => {
    await addDecision({ month: "2026-09", topic: "", text: "Niente", ownerId: "", dueOn: "" });
    expect(prisma.householdMember.findUnique).not.toHaveBeenCalled();
    expect(prisma.moneyDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ topic: null, ownerId: null, dueOn: null }),
    });
  });

  it("gives the job only to someone in the space", async () => {
    prisma.householdMember.findUnique.mockResolvedValue(null);
    const res = await addDecision({ ...decision, ownerId: "stranger" });
    expect(res.fieldErrors?.ownerId).toEqual(["Scegliete qualcuno dello spazio"]);
    expect(prisma.moneyDecision.create).not.toHaveBeenCalled();
  });

  it("rejects an empty decision, a deadline in the past and a month not over yet", async () => {
    expect((await addDecision({ ...decision, text: " " })).fieldErrors?.text).toBeDefined();
    expect((await addDecision({ ...decision, dueOn: "2026-10-07" })).fieldErrors?.dueOn).toEqual([
      "Scegliete una data da oggi in poi",
    ]);
    expect(await addDecision({ ...decision, month: "2026-10" })).toEqual({
      ok: false,
      error: "Si parla solo di un mese già finito.",
    });
    expect((await addDecision({ ...decision, month: "2026-13" })).fieldErrors?.month).toBeDefined();
    expect(prisma.moneyDecision.create).not.toHaveBeenCalled();
  });

  it("needs a shared space", async () => {
    prisma.householdMember.count.mockResolvedValue(1);
    const res = await addDecision(decision);
    expect(res.error).toMatch(/si fa in due/);
    expect(prisma.moneyDecision.create).not.toHaveBeenCalled();
  });

  it("stops at 50 open decisions", async () => {
    prisma.moneyDecision.count.mockResolvedValue(50);
    const res = await addDecision(decision);
    expect(res.error).toMatch(/50 decisioni aperte/);
    expect(prisma.moneyDecision.count).toHaveBeenCalledWith({
      where: { householdId: "space-1", doneAt: null },
    });
    expect(prisma.moneyDecision.create).not.toHaveBeenCalled();
  });
});

describe("the decision log", () => {
  it("ticks and unticks a decision of the space only", async () => {
    expect(await setDecisionDone("d1", true)).toEqual({ ok: true });
    expect(prisma.moneyDecision.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", householdId: "space-1" },
      data: { doneAt: new Date("2026-10-08T10:00:00Z") },
    });
    await setDecisionDone("d1", false);
    expect(prisma.moneyDecision.updateMany).toHaveBeenLastCalledWith({
      where: { id: "d1", householdId: "space-1" },
      data: { doneAt: null },
    });
  });

  it("deletes only in the space, and says when there's nothing to delete", async () => {
    expect(await deleteDecision("d1")).toEqual({ ok: true });
    expect(prisma.moneyDecision.deleteMany).toHaveBeenCalledWith({
      where: { id: "d1", householdId: "space-1" },
    });
    prisma.moneyDecision.deleteMany.mockResolvedValue({ count: 0 });
    expect((await deleteDecision("other-space")).ok).toBe(false);
    prisma.moneyDecision.updateMany.mockResolvedValue({ count: 0 });
    expect((await setDecisionDone("other-space", true)).ok).toBe(false);
  });
});

describe("the talk", () => {
  it("marks a past month as talked about, once", async () => {
    expect(await markTalkHeld("2026-09")).toEqual({ ok: true });
    expect(prisma.moneyTalk.upsert).toHaveBeenCalledWith({
      where: { householdId_month: { householdId: "space-1", month: day("2026-09-01") } },
      create: { householdId: "space-1", month: day("2026-09-01"), heldById: "user-1" },
      update: {},
    });
  });

  it("refuses the current month and solo spaces", async () => {
    expect((await markTalkHeld("2026-10")).ok).toBe(false);
    expect((await markTalkHeld("settembre")).ok).toBe(false);
    prisma.householdMember.count.mockResolvedValue(1);
    expect((await markTalkHeld("2026-09")).ok).toBe(false);
    expect(prisma.moneyTalk.upsert).not.toHaveBeenCalled();
  });

  it("undoes a talk marked by mistake", async () => {
    expect(await undoTalk("2026-09")).toEqual({ ok: true });
    expect(prisma.moneyTalk.deleteMany).toHaveBeenCalledWith({
      where: { householdId: "space-1", month: day("2026-09-01") },
    });
  });
});
