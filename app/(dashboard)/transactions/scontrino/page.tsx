import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReceiptView } from "@/components/receipts/receipt-view";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { getCoachAccess, PROVIDER_NAMES } from "@/lib/coach/access";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

export const metadata = { title: "Foto dello scontrino · Orbitly" };

export default async function ReceiptPage() {
  const space = await requireSpace();
  const [access, accounts, categories] = await Promise.all([
    getCoachAccess(space.user.id),
    prisma.financialAccount.findMany({
      where: { householdId: space.id, archived: false, type: { not: "INVESTMENT" } },
      select: { id: true, name: true, type: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({
      where: { householdId: space.id, type: "EXPENSE" },
      select: { id: true, name: true, parent: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  // Reading pictures needs Claude: with only the free text model, the feature is off.
  const status =
    access.status !== "off" && access.provider.id !== "anthropic" ? "off" : access.status;
  const byName = (name: string) =>
    categories.find((c) => c.name.toLocaleLowerCase("it") === name)?.id ?? null;
  const t = todayInAppTimeZone();

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <Link
          href="/transactions"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Transazioni
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Foto dello scontrino</h1>
        <p className="text-muted-foreground text-sm">
          Fotografa lo scontrino della farmacia: separo i farmaci detraibili dal resto e li metto
          nel tuo 730.
        </p>
      </div>
      <ReceiptView
        status={status}
        provider={access.status === "off" ? null : PROVIDER_NAMES[access.provider.id]}
        today={toDateInputValue(utcDate(t.year, t.month, t.day))}
        accounts={accounts}
        categories={categories
          .map((c) => ({ id: c.id, label: c.parent ? `${c.parent.name} › ${c.name}` : c.name }))
          .sort((a, b) => a.label.localeCompare(b.label, "it"))}
        defaults={{
          health: byName("farmacia") ?? byName("salute"),
          other: byName("cura personale") ?? byName("cosmetici") ?? byName("spesa"),
        }}
      />
    </div>
  );
}
