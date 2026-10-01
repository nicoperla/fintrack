import Link from "next/link";
import { requireSpace } from "@/lib/auth/session";
import { FormMessage } from "@/components/forms/form-field";
import { prisma } from "@/lib/db/prisma";
import { DigestToggle, ProfileForm } from "./settings-forms";
import { SpaceSettings } from "./space-settings";
import { WorkTimeForm } from "./work-time-form";
import { getWorkSettings } from "@/lib/data/work-time";
import { BillingSection, PrivacySection, type BillingInfo } from "./account-sections";
import { billingEnabled, PRO_FEATURES } from "@/lib/billing/plan";
import { getProPrice, refreshSubscription } from "@/lib/billing/stripe";
import { coachProvider } from "@/lib/coach/providers";
import { PROVIDER_NAMES } from "@/lib/coach/access";
import { RULES } from "@/lib/rate-limit";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Impostazioni · FinTrack" };

type SearchParams = { billing?: string | string[] };

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const space = await requireSpace();

  // Back from Stripe Checkout: don't wait for the webhook to show Pro.
  if (searchParams.billing === "success" && billingEnabled()) {
    const row = await prisma.user.findUnique({
      where: { id: space.user.id },
      select: { stripeCustomerId: true },
    });
    if (row?.stripeCustomerId) {
      await refreshSubscription(row.stripeCustomerId).catch((error) =>
        console.error("[billing] aggiornamento abbonamento fallito", error),
      );
    }
  }
  const [user, members, invites, work] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: space.user.id },
      select: {
        name: true,
        email: true,
        weeklyDigest: true,
        aiConsentAt: true,
        plan: true,
        subscriptionStatus: true,
        planRenewsAt: true,
        planCancelsAtEnd: true,
      },
    }),
    prisma.householdMember.findMany({
      where: { householdId: space.id },
      orderBy: { joinedAt: "asc" },
      select: { role: true, user: { select: { id: true, name: true, email: true } } },
    }),
    space.role === "OWNER"
      ? prisma.householdInvite.findMany({
          where: { householdId: space.id, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, expiresAt: true },
        })
      : Promise.resolve([]),
    getWorkSettings(space.user.id, space.id),
  ]);
  const price = billingEnabled() ? await getProPrice() : null;
  const provider = coachProvider();
  const billing: BillingInfo = {
    enabled: billingEnabled(),
    plan: user.plan,
    status: user.subscriptionStatus,
    renewsAt: user.planRenewsAt?.toISOString() ?? null,
    cancelsAtEnd: user.planCancelsAtEnd,
    priceLabel: price
      ? `${formatCurrency(price.amount, price.currency)} al ${price.interval === "year" ? "anno" : "mese"}`
      : null,
    features: PRO_FEATURES,
    dailyQuestions: RULES.coachDaily.limit,
  };

  return (
    <div className="grid max-w-2xl grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="text-muted-foreground text-sm">
          Profilo, spazio condiviso, notifiche, abbonamento e privacy.
        </p>
      </div>
      <section
        className="bg-card grid gap-4 rounded-2xl border p-5"
        aria-labelledby="profile-title"
      >
        <h2 id="profile-title" className="font-medium">
          Profilo
        </h2>
        <ProfileForm name={user.name ?? ""} email={user.email} />
      </section>
      <section className="bg-card grid gap-4 rounded-2xl border p-5" aria-labelledby="space-title">
        <div>
          <h2 id="space-title" className="font-medium">
            Spazio «{space.name}»
          </h2>
          <p className="text-muted-foreground text-sm">
            Invita partner o famiglia: vedrete gli stessi conti, movimenti, budget e obiettivi.
          </p>
        </div>
        <SpaceSettings
          data={{
            name: space.name,
            currency: space.currency,
            isOwner: space.role === "OWNER",
            currentUserId: space.user.id,
            members: members.map((m) => ({
              userId: m.user.id,
              name: m.user.name ?? m.user.email.split("@")[0],
              email: m.user.email,
              role: m.role,
            })),
            invites: invites.map((i) => ({
              id: i.id,
              email: i.email,
              expiresAt: i.expiresAt.toISOString(),
            })),
          }}
        />
      </section>
      <section className="bg-card grid gap-4 rounded-2xl border p-5" aria-label="Tempo di lavoro">
        <WorkTimeForm
          manualIncome={work.manualIncome}
          estimatedIncome={work.estimatedIncome}
          weeklyHours={work.weeklyHours}
          enabled={work.enabled}
        />
      </section>
      <section className="bg-card grid gap-4 rounded-2xl border p-5" aria-label="Notifiche">
        <DigestToggle enabled={user.weeklyDigest} />
      </section>
      <section
        id="abbonamento"
        className="bg-card grid scroll-mt-20 gap-4 rounded-2xl border p-5"
        aria-labelledby="billing-title"
      >
        <h2 id="billing-title" className="font-medium">
          Abbonamento
        </h2>
        {searchParams.billing === "success" && (
          <FormMessage tone="success">
            Grazie!{" "}
            {user.plan === "PRO"
              ? "FinTrack Pro è attivo."
              : "Stiamo attivando Pro: ricarica tra qualche secondo."}
          </FormMessage>
        )}
        <BillingSection billing={billing} />
      </section>
      <section
        id="privacy"
        className="bg-card grid scroll-mt-20 gap-4 rounded-2xl border p-5"
        aria-labelledby="privacy-title"
      >
        <div>
          <h2 id="privacy-title" className="font-medium">
            Privacy e dati
          </h2>
          <p className="text-muted-foreground text-sm">
            Come trattiamo i tuoi dati è spiegato nell&apos;
            <Link href="/privacy" className="underline underline-offset-4">
              informativa sulla privacy
            </Link>
            .
          </p>
        </div>
        <PrivacySection
          aiConsent={user.aiConsentAt !== null}
          aiProvider={provider ? PROVIDER_NAMES[provider.id] : null}
        />
      </section>
    </div>
  );
}
