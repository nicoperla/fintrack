import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmergencyFund, saveCrashProfile } from "./actions";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma } = vi.hoisted(() => ({
  prisma: {
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    goal: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", currency: "EUR", user: { id: "user-1" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const taxProfile = {
  incomeBand: "fino-31k",
  birthYear: 1980,
  rent: { contract: null, since: null, transferred: false },
  welfare: { balance: null, expiresOn: null, fringe: null, fringeYear: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T10:00:00Z"));
  prisma.user.findUniqueOrThrow.mockResolvedValue({ taxProfile });
  prisma.goal.findMany.mockResolvedValue([{ name: "Vacanza" }]);
});
afterEach(() => vi.useRealTimers());

describe("saveCrashProfile", () => {
  it("saves the job on the user and the birth year in the tax profile", async () => {
    const res = await saveCrashProfile({
      work: "employee",
      ral: "28.000",
      since: "2019-03",
      birthYear: "1970",
    });
    expect(res).toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        crashProfile: { work: "employee", ral: 28000, since: "2019-03" },
        taxProfile: { ...taxProfile, birthYear: 1970 },
      },
    });
  });

  it("keeps the birth year it already had when none is given", async () => {
    await saveCrashProfile({ work: "self-employed", ral: "", since: "", birthYear: "" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        crashProfile: { work: "self-employed", ral: null, since: null },
        taxProfile: { ...taxProfile, birthYear: 1980 },
      },
    });
  });

  it("rejects a future month, a bad RAL and an unknown kind of work", async () => {
    const future = await saveCrashProfile({
      work: "employee",
      ral: "",
      since: "2026-11",
      birthYear: "",
    });
    expect(future.fieldErrors?.since).toEqual(["Scegli un mese passato"]);
    const ral = await saveCrashProfile({
      work: "employee",
      ral: "tanti",
      since: "",
      birthYear: "",
    });
    expect(ral.fieldErrors?.ral).toBeDefined();
    const work = await saveCrashProfile({ work: "boss", ral: "", since: "", birthYear: "" });
    expect(work.fieldErrors?.work).toBeDefined();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("accepts the current month", async () => {
    const res = await saveCrashProfile({
      work: "employee",
      ral: "",
      since: "2026-10",
      birthYear: "",
    });
    expect(res).toEqual({ ok: true });
  });
});

describe("createEmergencyFund", () => {
  it("creates the goal in the space", async () => {
    expect(await createEmergencyFund(7800)).toEqual({ ok: true });
    expect(prisma.goal.findMany).toHaveBeenCalledWith({
      where: { householdId: "space-1" },
      select: { name: true },
    });
    expect(prisma.goal.create).toHaveBeenCalledWith({
      data: {
        householdId: "space-1",
        userId: "user-1",
        name: "Fondo emergenza",
        targetAmount: 7800,
        icon: "piggy-bank",
        color: "#22c55e",
      },
    });
  });

  it("doesn't make a second one", async () => {
    prisma.goal.findMany.mockResolvedValue([{ name: "Fondo per gli imprevisti" }]);
    const res = await createEmergencyFund(7800);
    expect(res.ok).toBe(false);
    expect(prisma.goal.create).not.toHaveBeenCalled();
  });

  it("refuses a target that makes no sense", async () => {
    expect((await createEmergencyFund(0)).ok).toBe(false);
    expect((await createEmergencyFund(Number.NaN)).ok).toBe(false);
    expect(prisma.goal.create).not.toHaveBeenCalled();
  });
});
