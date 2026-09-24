import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Link href="/" className="text-xl font-semibold tracking-tight">
        FinTrack
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
