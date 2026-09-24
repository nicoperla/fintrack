import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { DesktopNav, MobileNav } from "@/components/layout/app-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
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
            <span className="text-muted-foreground hidden truncate text-sm xl:inline">
              {user.email}
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 lg:pb-10">{children}</main>
      <MobileNav />
    </div>
  );
}
