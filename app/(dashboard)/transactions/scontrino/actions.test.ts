import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveReceipt } from "./actions";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma, saveTransactionInSpace } = vi.hoisted(() => ({
  prisma: { transaction: { updateMany: vi.fn() } },
  saveTransactionInSpace: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/transactions/save", () => ({ saveTransactionInSpace }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", currency: "EUR", user: { id: "user-1" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const base = {
  accountId: "acc-1",
  date: "2026-10-12",
  merchant: "Farmacia Centrale",
  fiscalCode: true,
  keepReceipt: true,
  health: { amount: "22,40", categoryId: "cat-farmacia" },
  other: { amount: "9,00", categoryId: "cat-cura" },
};

beforeEach(() => {
  vi.clearAllMocks();
  saveTransactionInSpace
    .mockResolvedValueOnce({ ok: true, warnings: ["Superata la franchigia"], id: "tx-1" })
    .mockResolvedValueOnce({ ok: true, warnings: [], id: "tx-2" });
});

describe("saveReceipt", () => {
  it("saves the health part and the rest as two movements, only totals", async () => {
    const res = await saveReceipt(base);
    expect(res).toEqual({ ok: true, warnings: ["Superata la franchigia"] });
    const calls = saveTransactionInSpace.mock.calls.map((c) => c[2]);
    expect(calls).toEqual([
      expect.objectContaining({
        type: "EXPENSE",
        amount: "22,40",
        description: "Farmacia Centrale · farmaci",
        categoryId: "cat-farmacia",
        tags: "scontrino",
      }),
      expect.objectContaining({ amount: "9,00", description: "Farmacia Centrale · altro" }),
    ]);
    // The receipt is kept: the 730 folder ticks it.
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: "tx-1", householdId: "space-1" },
      data: { deductionDoc: "have" },
    });
    // What the user left out of the 730 stays out, even with «Farmacia» in its name.
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: "tx-2", householdId: "space-1" },
      data: { deduction: "none" },
    });
  });

  it("marks medicines without the codice fiscale as not deductible", async () => {
    await saveReceipt({ ...base, fiscalCode: false, other: null });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: "tx-1", householdId: "space-1" },
      data: { deduction: "none", notes: "Scontrino senza codice fiscale: non detraibile." },
    });
  });

  it("refuses an empty receipt and a missing account", async () => {
    expect(await saveReceipt({ ...base, health: null, other: null })).toEqual({
      ok: false,
      error: "Niente da salvare.",
    });
    expect((await saveReceipt({ ...base, accountId: "" })).ok).toBe(false);
  });
});
