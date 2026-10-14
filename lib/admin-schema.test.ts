import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EMAIL_FILES, emailHeader, HEADER } from "../scripts/sync-admin-schema.mjs";

const root = path.resolve(import.meta.dirname, "..");
// Line endings aside: git may check either file out with CRLF on Windows.
const read = (file: string) => readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

describe("admin panel copies (run node scripts/sync-admin-schema.mjs)", () => {
  it("has the same schema as Orbitly", () => {
    expect(read("admin/prisma/schema.prisma")).toBe(HEADER + read("prisma/schema.prisma"));
  });

  it.each(EMAIL_FILES)("has the same %s", (source, copy) => {
    expect(read(copy)).toBe(emailHeader(source) + read(source));
  });
});
