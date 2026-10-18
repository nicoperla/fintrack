import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteDocument, saveDocument, setStepDone, startJourney } from "./actions";

// vi.mock is hoisted above the imports: the mocks it uses must be hoisted too.
const { prisma } = vi.hoisted(() => ({
  prisma: {
    userJourney: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    personalDocument: { count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireSpace: async () => ({ id: "space-1", currency: "EUR", user: { id: "user-1" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-18T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("startJourney", () => {
  it("starts a journey for the person, from the day of the event", async () => {
    expect(await startJourney({ key: "lavoro", eventDate: "2026-10-01" })).toEqual({ ok: true });
    expect(prisma.userJourney.upsert).toHaveBeenCalledWith({
      where: { userId_key: { userId: "user-1", key: "lavoro" } },
      create: { userId: "user-1", key: "lavoro", eventDate: new Date("2026-10-01T00:00:00Z") },
      update: { eventDate: new Date("2026-10-01T00:00:00Z") },
    });
  });

  it("refuses unknown journeys and dates too far away", async () => {
    expect((await startJourney({ key: "luna", eventDate: "2026-10-01" })).ok).toBe(false);
    const far = await startJourney({ key: "casa", eventDate: "2035-01-01" });
    expect(far.fieldErrors?.eventDate).toBeDefined();
    expect(prisma.userJourney.upsert).not.toHaveBeenCalled();
  });
});

describe("setStepDone", () => {
  it("adds and removes a step of a started journey", async () => {
    prisma.userJourney.findUnique.mockResolvedValue({ done: ["naspi"] });
    await setStepDone("lavoro", "tfr", true);
    expect(prisma.userJourney.update.mock.calls[0][0].data).toEqual({ done: ["naspi", "tfr"] });
    await setStepDone("lavoro", "naspi", false);
    expect(prisma.userJourney.update.mock.calls[1][0].data).toEqual({ done: [] });
  });

  it("ignores steps that aren't in the journey", async () => {
    expect(await setStepDone("lavoro", "nascita", true)).toEqual({
      ok: false,
      error: "Non trovato.",
    });
    expect(prisma.userJourney.update).not.toHaveBeenCalled();
  });
});

describe("documents", () => {
  it("saves kind, name and date only", async () => {
    prisma.personalDocument.count.mockResolvedValue(0);
    const res = await saveDocument(null, {
      kind: "CIE",
      label: "Carta di Luca",
      expiresOn: "2027-03-01",
    });
    expect(res).toEqual({ ok: true });
    expect(prisma.personalDocument.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        kind: "CIE",
        label: "Carta di Luca",
        expiresOn: new Date("2027-03-01T00:00:00Z"),
      },
    });
  });

  it("changes and deletes only the person's own documents", async () => {
    prisma.personalDocument.updateMany.mockResolvedValue({ count: 0 });
    const res = await saveDocument("doc-x", {
      kind: "PATENTE",
      label: "Patente",
      expiresOn: "2030-01-01",
    });
    expect(res.ok).toBe(false);
    expect(prisma.personalDocument.updateMany.mock.calls[0][0].where).toEqual({
      id: "doc-x",
      userId: "user-1",
    });
    prisma.personalDocument.deleteMany.mockResolvedValue({ count: 1 });
    expect(await deleteDocument("doc-1")).toEqual({ ok: true });
    expect(prisma.personalDocument.deleteMany).toHaveBeenCalledWith({
      where: { id: "doc-1", userId: "user-1" },
    });
  });
});
