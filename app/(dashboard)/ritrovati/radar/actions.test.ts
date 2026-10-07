import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveRentProfile, saveWelfare } from "./actions";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma } = vi.hoisted(() => ({
  prisma: { user: { findUniqueOrThrow: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", currency: "EUR", user: { id: "user-1" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const welfare = { balance: 350, expiresOn: "2026-12-31", fringe: 600, fringeYear: 2026 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
  prisma.user.findUniqueOrThrow.mockResolvedValue({
    taxProfile: { incomeBand: "oltre", welfare },
  });
});
afterEach(() => vi.useRealTimers());

describe("saveRentProfile", () => {
  it("saves the answers on the user, keeping the rest of the profile", async () => {
    const res = await saveRentProfile({
      incomeBand: "fino-15k",
      birthYear: "1999",
      contract: "libero",
      since: "2024",
      transferred: false,
    });
    expect(res).toEqual({ ok: true });
    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        taxProfile: {
          incomeBand: "fino-15k",
          birthYear: 1999,
          rent: { contract: "libero", since: 2024, transferred: false },
          welfare,
        },
      },
    });
  });

  it("forgets the contract details of someone who doesn't rent", async () => {
    await saveRentProfile({ incomeBand: "", contract: "", since: "2020", transferred: true });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          taxProfile: expect.objectContaining({
            rent: { contract: null, since: null, transferred: false },
          }),
        },
      }),
    );
  });

  it("rejects invalid answers without saving", async () => {
    const res = await saveRentProfile({ incomeBand: "", contract: "", birthYear: "2030" });
    expect(res.fieldErrors?.birthYear).toBeDefined();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("saveWelfare", () => {
  it("dates the fringe benefits to this year", async () => {
    await saveWelfare({ balance: "200", expiresOn: "2026-11-30", fringe: "950" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        taxProfile: expect.objectContaining({
          incomeBand: "oltre",
          welfare: { balance: 200, expiresOn: "2026-11-30", fringe: 950, fringeYear: 2026 },
        }),
      },
    });
  });

  it("drops the expiry date without a credit", async () => {
    await saveWelfare({ balance: "", expiresOn: "2026-11-30", fringe: "" });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          taxProfile: expect.objectContaining({
            welfare: { balance: null, expiresOn: null, fringe: null, fringeYear: null },
          }),
        },
      }),
    );
  });
});
