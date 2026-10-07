import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteClaim,
  markClaimSent,
  openClaim,
  recordClaimOutcome,
  updateClaimLetter,
} from "./actions";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma } = vi.hoisted(() => ({
  prisma: {
    user: { findUniqueOrThrow: vi.fn() },
    transaction: { findFirst: vi.fn() },
    claim: {
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({
    id: "space-1",
    currency: "EUR",
    user: { id: "user-1", name: "Anna Rossi" },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ours = (where: object) => expect.objectContaining({ where });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUniqueOrThrow.mockResolvedValue({ plan: "FREE", name: "Anna Rossi" });
  prisma.claim.count.mockResolvedValue(0);
  prisma.claim.findUnique.mockResolvedValue(null);
  prisma.claim.updateMany.mockResolvedValue({ count: 1 });
  prisma.claim.deleteMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.unstubAllEnvs());

describe("claims belong to their space", () => {
  it("never reads or changes a claim of another space", async () => {
    prisma.claim.updateMany.mockResolvedValue({ count: 0 });
    prisma.claim.deleteMany.mockResolvedValue({ count: 0 });
    prisma.claim.findFirst.mockResolvedValue(null);

    expect((await updateClaimLetter("claim-x", { subject: "Oggetto", body: "Testo" })).ok).toBe(
      false,
    );
    expect(prisma.claim.updateMany).toHaveBeenCalledWith(
      ours({ id: "claim-x", householdId: "space-1", status: "DRAFT" }),
    );

    expect(await markClaimSent("claim-x", { channel: "pec", sentAt: "2026-10-01" })).toEqual({
      ok: false,
      error: "Pratica non trovata.",
    });
    expect(prisma.claim.findFirst).toHaveBeenCalledWith(
      ours({ id: "claim-x", householdId: "space-1" }),
    );

    expect((await recordClaimOutcome("claim-x", { status: "DROPPED" })).ok).toBe(false);
    expect((await deleteClaim("claim-x")).ok).toBe(false);
    expect(prisma.claim.deleteMany).toHaveBeenCalledWith(
      ours({ id: "claim-x", householdId: "space-1" }),
    );
  });

  it("only contests charges of the space", async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);
    const res = await openClaim({
      kind: "DUPLICATE_CHARGE",
      counterparty: "Zalando",
      amount: "59,90",
      transactionId: "tx-other",
    });
    expect(res).toEqual({ ok: false, error: "Movimento non trovato." });
    expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
      ours({ id: "tx-other", householdId: "space-1", type: "EXPENSE" }),
    );
    expect(prisma.claim.create).not.toHaveBeenCalled();
  });
});

describe("plans", () => {
  const cancellation = { kind: "CANCELLATION", counterparty: "Netflix", amount: "155,88" };

  it("lets the free plan follow one claim at a time", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    vi.stubEnv("STRIPE_PRICE_ID", "price_fake");
    prisma.claim.count.mockResolvedValue(1);

    const res = await openClaim(cancellation);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("una pratica alla volta");
    expect(prisma.claim.create).not.toHaveBeenCalled();
  });

  it("has no limit with Pro", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
    vi.stubEnv("STRIPE_PRICE_ID", "price_fake");
    prisma.user.findUniqueOrThrow.mockResolvedValue({ plan: "PRO", name: "Anna Rossi" });
    prisma.claim.count.mockResolvedValue(7);
    prisma.claim.create.mockResolvedValue({ id: "claim-2" });

    expect(await openClaim(cancellation)).toEqual({ ok: true, id: "claim-2" });
  });
});

describe("openClaim", () => {
  it("goes to the claim the finding already has", async () => {
    prisma.claim.findUnique.mockResolvedValue({ id: "claim-9" });
    expect(
      await openClaim({
        kind: "DUPLICATE_CHARGE",
        counterparty: "Zalando",
        amount: "59,90",
        findingKey: "dup:tx-1",
      }),
    ).toEqual({ ok: true, id: "claim-9" });
    expect(prisma.claim.create).not.toHaveBeenCalled();
  });

  it("writes the refund request with the 8 weeks counted from the charge", async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      date: new Date("2026-10-02T00:00:00.000Z"),
      description: "SDD FITLIFE PALESTRA",
      category: { name: "Palestra" },
    });
    prisma.claim.create.mockResolvedValue({ id: "claim-1" });

    const res = await openClaim({
      kind: "DIRECT_DEBIT_REFUND",
      counterparty: "FitLife Palestra",
      amount: "45",
      transactionId: "tx-1",
      findingKey: "after:tx-1",
      effectiveFrom: "2026-10-01",
    });
    expect(res).toEqual({ ok: true, id: "claim-1" });

    const { data } = prisma.claim.create.mock.calls[0][0];
    expect(data).toMatchObject({
      householdId: "space-1",
      userId: "user-1",
      kind: "DIRECT_DEBIT_REFUND",
      findingKey: "after:tx-1",
      transactionId: "tx-1",
      expectedAmount: "45.00",
      deadline: new Date("2026-11-27T00:00:00.000Z"),
      effectiveFrom: null,
    });
    expect(data.body).toContain("addebito diretto SEPA di 45,00 € del 2 ottobre 2026");
    expect(data.body).toContain("disdetto con effetto dal 1 ottobre 2026");
    expect(data.body).toContain("Anna Rossi");
  });
});

describe("markClaimSent", () => {
  it("needs the date a cancellation takes effect", async () => {
    prisma.claim.findFirst.mockResolvedValue({
      kind: "CANCELLATION",
      status: "DRAFT",
      effectiveFrom: null,
      transaction: null,
    });
    const res = await markClaimSent("claim-1", { channel: "email", sentAt: "2026-10-01" });
    expect(res.fieldErrors?.effectiveFrom).toBeDefined();
    expect(prisma.claim.updateMany).not.toHaveBeenCalled();

    await markClaimSent("claim-1", {
      channel: "email",
      sentAt: "2026-10-01",
      effectiveFrom: "2026-11-01",
    });
    expect(prisma.claim.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SENT",
          effectiveFrom: new Date("2026-11-01T00:00:00.000Z"),
          deadline: null,
        }),
      }),
    );
  });

  it("gives the bank 15 business days to answer about a payment", async () => {
    prisma.claim.findFirst.mockResolvedValue({
      kind: "BANK_COMPLAINT",
      status: "DRAFT",
      effectiveFrom: null,
      transaction: { description: "Zalando SE", category: { name: "Abbigliamento" } },
    });
    expect((await markClaimSent("claim-1", { channel: "pec", sentAt: "2026-10-06" })).ok).toBe(
      true,
    );
    expect(prisma.claim.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deadline: new Date("2026-10-27T00:00:00.000Z") }),
      }),
    );
  });

  it("won't send a claim twice", async () => {
    prisma.claim.findFirst.mockResolvedValue({
      kind: "DUPLICATE_CHARGE",
      status: "SENT",
      effectiveFrom: null,
      transaction: null,
    });
    expect((await markClaimSent("claim-1", { channel: "email", sentAt: "2026-10-06" })).ok).toBe(
      false,
    );
    expect(prisma.claim.updateMany).not.toHaveBeenCalled();
  });
});
