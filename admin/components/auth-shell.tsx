import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

/** The frame of the sign-in and setup pages. */
export function AuthShell({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <p className="mb-6 flex items-center justify-center gap-2 text-sm font-semibold tracking-wide text-white uppercase">
          <ShieldCheck className="text-accent size-5" aria-hidden />
          FinTrack Admin
        </p>
        <div className="border-line bg-panel rounded-2xl border p-6 shadow-2xl">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <p className="text-muted mt-1 mb-5 text-sm">{text}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
