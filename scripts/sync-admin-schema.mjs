// Copies into the admin panel what it shares with the app, so the panel builds on its own (a
// separate Vercel project with root directory "admin"): prisma/schema.prisma, and the emails'
// design and wording (lib/emails/layout.ts and templates.ts), so a password reset sent from the
// panel looks like the one sent by Orbitly. Run it after changing any of them: a test
// (lib/admin-schema.test.ts) fails while a copy is out of date.
// Migrations stay here: the panel never migrates the database.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const HEADER =
  "// COPY of ../../prisma/schema.prisma, written by scripts/sync-admin-schema.mjs: don't edit.\n" +
  "// The Orbitly app owns the schema and its migrations.\n\n";

/** The email files: source in the app, copy in the panel. */
export const EMAIL_FILES = [
  ["lib/emails/layout.ts", "admin/lib/emails/layout.ts"],
  ["lib/emails/templates.ts", "admin/lib/emails/templates.ts"],
];

export const emailHeader = (source) =>
  `// COPY of ${source} in the app, written by scripts/sync-admin-schema.mjs: don't edit.\n\n`;

const root = new URL("..", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8").replace(/\r\n/g, "\n");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL("admin/prisma/schema.prisma", root), HEADER + read("prisma/schema.prisma"));
  console.log("admin/prisma/schema.prisma aggiornato");
  for (const [source, copy] of EMAIL_FILES) {
    const target = new URL(copy, root);
    mkdirSync(new URL(".", target), { recursive: true });
    writeFileSync(target, emailHeader(source) + read(source));
    console.log(`${copy} aggiornato`);
  }
}
