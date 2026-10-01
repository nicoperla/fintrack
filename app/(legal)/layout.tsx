import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";

/** Public pages (privacy, terms): readable without an account. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight">
            FinTrack
          </Link>
          <Link href="/login" className="text-muted-foreground hover:text-foreground text-sm">
            Accedi
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
