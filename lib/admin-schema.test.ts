import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HEADER } from "../scripts/sync-admin-schema.mjs";

const root = path.resolve(import.meta.dirname, "..");

describe("admin panel schema", () => {
  it("is the same as FinTrack's (run node scripts/sync-admin-schema.mjs)", () => {
    // Line endings aside: git may check either file out with CRLF on Windows.
    const read = (file: string) =>
      readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
    expect(read("admin/prisma/schema.prisma")).toBe(HEADER + read("prisma/schema.prisma"));
  });
});
