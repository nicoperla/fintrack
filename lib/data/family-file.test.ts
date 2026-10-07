import { beforeEach, describe, expect, it, vi } from "vitest";
import { openSharedFamilyFile } from "./family-file";
import { hashShareToken, newShareToken } from "@/lib/family-file-tokens";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma } = vi.hoisted(() => ({
  prisma: {
    familyFileShare: { findUnique: vi.fn(), update: vi.fn() },
    household: { findUniqueOrThrow: vi.fn() },
    debt: { findMany: vi.fn() },
    familyFile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/data/accounts", () => ({
  getAccountsWithBalances: async () => [
    {
      name: "Conto corrente",
      type: "CHECKING",
      currency: "EUR",
      balance: { toNumber: () => 2400 },
      archived: false,
    },
  ],
}));
vi.mock("@/lib/data/investments", () => ({ getInvestments: async () => ({ accounts: [] }) }));
vi.mock("@/lib/data/intelligence", () => ({ getRecurring: async () => [] }));

const { token } = newShareToken();
const DAY_MS = 86_400_000;

beforeEach(() => {
  vi.clearAllMocks();
  prisma.household.findUniqueOrThrow.mockResolvedValue({
    name: "Casa Rossi",
    currency: "EUR",
    members: [{ user: { name: "Anna", email: "anna@example.com" } }],
  });
  prisma.debt.findMany.mockResolvedValue([]);
  prisma.familyFile.findUnique.mockResolvedValue({ notes: { documenti: "Nel cassetto" } });
});

const share = (patch: object = {}) => ({
  id: "share-1",
  householdId: "space-1",
  label: "Marco",
  showAmounts: false,
  expiresAt: new Date(Date.now() + 7 * DAY_MS),
  revokedAt: null,
  ...patch,
});

describe("openSharedFamilyFile", () => {
  it("turns away a malformed token without looking it up", async () => {
    expect(await openSharedFamilyFile("../../etc")).toBeNull();
    expect(prisma.familyFileShare.findUnique).not.toHaveBeenCalled();
  });

  it("looks links up by the hash of their token", async () => {
    prisma.familyFileShare.findUnique.mockResolvedValue(null);
    expect(await openSharedFamilyFile(token)).toBeNull();
    expect(prisma.familyFileShare.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashShareToken(token) } }),
    );
  });

  it("says nothing for expired or revoked links, and doesn't count them", async () => {
    prisma.familyFileShare.findUnique.mockResolvedValue(
      share({ expiresAt: new Date(Date.now() - 1000) }),
    );
    expect(await openSharedFamilyFile(token)).toBeNull();
    prisma.familyFileShare.findUnique.mockResolvedValue(share({ revokedAt: new Date() }));
    expect(await openSharedFamilyFile(token)).toBeNull();
    expect(prisma.familyFileShare.update).not.toHaveBeenCalled();
  });

  it("opens an active link, counting the visit, without amounts unless chosen", async () => {
    prisma.familyFileShare.findUnique.mockResolvedValue(share());
    const opened = await openSharedFamilyFile(token);
    expect(prisma.familyFileShare.update).toHaveBeenCalledWith({
      where: { id: "share-1" },
      data: { views: { increment: 1 }, lastViewedAt: expect.any(Date) },
    });
    expect(opened?.label).toBe("Marco");
    expect(opened?.content.accounts).toEqual([
      {
        name: "Conto corrente",
        kind: "Conto corrente",
        currency: "EUR",
        balance: null,
        archived: false,
      },
    ]);
    expect(opened?.content.notes).toEqual([
      { title: "Dove sono i documenti", text: "Nel cassetto" },
    ]);

    prisma.familyFileShare.findUnique.mockResolvedValue(share({ showAmounts: true }));
    expect((await openSharedFamilyFile(token))?.content.accounts[0].balance).toBe(2400);
  });
});
