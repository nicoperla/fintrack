import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/layout/sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            FinTrack
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-muted-foreground truncate text-sm">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
