import Link from "next/link";
import { cookies } from "next/headers";
import { Settings } from "lucide-react";
import { requireSpace } from "@/lib/auth/session";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { DesktopNav, MobileNav } from "@/components/layout/app-nav";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CurrencyProvider } from "@/components/currency-provider";
import { HIDE_AMOUNTS_COOKIE } from "@/lib/privacy";
import { PrivacyToggle } from "@/components/layout/privacy-toggle";
import { getWorkSettings } from "@/lib/data/work-time";
import { SpaceSwitcher } from "@/components/layout/space-switcher";
import { OfflineSync } from "@/components/offline/offline-sync";
import { VerifyEmailBanner } from "@/components/layout/verify-email-banner";
import { prisma } from "@/lib/db/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const space = await requireSpace();
  const shared = (space.spaces.find((s) => s.id === space.id)?.memberCount ?? 1) > 1;
  const [work, account] = await Promise.all([
    getWorkSettings(space.user.id, space.id),
    prisma.user.findUniqueOrThrow({
      where: { id: space.user.id },
      select: { email: true, emailVerifiedAt: true },
    }),
  ]);

  return (
    <CurrencyProvider
      currency={space.currency}
      shared={shared}
      spaceId={space.id}
      userId={space.user.id}
      workRate={work.rate}
      initialHidden={cookies().get(HIDE_AMOUNTS_COOKIE)?.value === "1"}
    >
      <div className="flex min-h-svh flex-col">
        <header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="font-semibold tracking-tight">
                FinTrack
              </Link>
              <DesktopNav />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <SpaceSwitcher current={space.id} spaces={space.spaces} />
              <PrivacyToggle />
              <ThemeToggle />
              <Link
                href="/settings"
                aria-label="Impostazioni"
                title="Impostazioni"
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              >
                <Settings />
              </Link>
              <SignOutButton />
            </div>
          </div>
          <OfflineSync />
        </header>
        {!account.emailVerifiedAt && <VerifyEmailBanner email={account.email} />}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 lg:pb-10">{children}</main>
        <MobileNav />
      </div>
    </CurrencyProvider>
  );
}
