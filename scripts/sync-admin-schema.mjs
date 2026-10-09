// Copies prisma/schema.prisma into the admin panel (admin/prisma/schema.prisma), so the panel
// builds on its own (a separate Vercel project with root directory "admin"). Run it after every
// schema change: a test (lib/admin-schema.test.ts) fails while the copy is out of date.
// Migrations stay here: the panel never migrates the database.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const HEADER =
  "// COPY of ../../prisma/schema.prisma, written by scripts/sync-admin-schema.mjs: don't edit.\n" +
  "// The FinTrack app owns the schema and its migrations.\n\n";

const root = new URL("..", import.meta.url);
const source = readFileSync(new URL("prisma/schema.prisma", root), "utf8");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL("admin/prisma/schema.prisma", root), HEADER + source);
  console.log("admin/prisma/schema.prisma aggiornato");
}
