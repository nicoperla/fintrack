import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LetterView } from "@/components/tax/letter-view";
import { requireSpace } from "@/lib/auth/session";
import { getCoachAccess, PROVIDER_NAMES } from "@/lib/coach/access";

export const metadata = { title: "Spiegami questa lettera · Orbitly" };

export default async function LetterPage() {
  const space = await requireSpace();
  const access = await getCoachAccess(space.user.id);
  // Reading pictures needs Claude: with only the free text model, the feature is off.
  const status =
    access.status !== "off" && access.provider.id !== "anthropic" ? "off" : access.status;

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <Link
          href="/730"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Il mio 730
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Spiegami questa lettera</h1>
        <p className="text-muted-foreground text-sm">
          Una lettera che non capisci? Fotografala: ti dico cos&apos;è, cosa fare ed entro quando.
        </p>
      </div>
      <LetterView
        status={status}
        provider={access.status === "off" ? null : PROVIDER_NAMES[access.provider.id]}
      />
    </div>
  );
}
