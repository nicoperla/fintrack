import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "./session";

const { getServerSession, findUnique } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  findUnique: vi.fn(),
}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/lib/households", () => ({ getActiveSpace: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique } } }));

const session = (sv?: number) => ({
  user: { id: "user-1" },
  expires: "",
  ...(sv === undefined ? {} : { sv }),
});

beforeEach(() => vi.clearAllMocks());

describe("getSession", () => {
  it("accepts a session started with the account's current version", async () => {
    getServerSession.mockResolvedValue(session(3));
    findUnique.mockResolvedValue({ sessionVersion: 3 });
    expect(await getSession()).toEqual(session(3));
  });

  it("refuses a session from before a password change or 'sign out everywhere'", async () => {
    getServerSession.mockResolvedValue(session(2));
    findUnique.mockResolvedValue({ sessionVersion: 3 });
    expect(await getSession()).toBeNull();
  });

  it("reads sessions older than versions as version 0", async () => {
    getServerSession.mockResolvedValue(session());
    findUnique.mockResolvedValue({ sessionVersion: 0 });
    expect(await getSession()).not.toBeNull();
    findUnique.mockResolvedValue({ sessionVersion: 1 });
    expect(await getSession()).toBeNull();
  });

  it("refuses the session of a suspended account", async () => {
    getServerSession.mockResolvedValue(session(0));
    findUnique.mockResolvedValue({ sessionVersion: 0, suspendedAt: new Date() });
    expect(await getSession()).toBeNull();
  });

  it("refuses the session of a deleted account", async () => {
    getServerSession.mockResolvedValue(session(0));
    findUnique.mockResolvedValue(null);
    expect(await getSession()).toBeNull();
  });
});
