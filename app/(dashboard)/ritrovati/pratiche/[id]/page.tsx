import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ClaimDetail } from "@/components/claims/claim-detail";
import { requireSpace } from "@/lib/auth/session";
import { getClaim } from "@/lib/data/claims";

export const metadata = { title: "Pratica · FinTrack" };

export default async function ClaimPage({ params }: { params: { id: string } }) {
  const space = await requireSpace();
  const data = await getClaim(space.user.id, space.id, params.id);
  if (!data) notFound();

  return (
    <div className="grid grid-cols-1 gap-6">
      <Link
        href="/ritrovati/pratiche"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 justify-self-start text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Le tue pratiche
      </Link>
      <ClaimDetail
        claim={data.claim}
        chargesAfter={data.chargesAfter}
        pro={data.pro}
        today={data.today}
      />
    </div>
  );
}
