import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm">
        <p>© {new Date().getFullYear()} FinTrack</p>
        <nav className="flex gap-4" aria-label="Note legali">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Termini
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Accedi
          </Link>
        </nav>
      </div>
    </footer>
  );
}
