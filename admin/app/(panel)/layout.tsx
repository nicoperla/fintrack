import { LogOut, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/toast";
import { logout } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="lg:grid lg:min-h-svh lg:grid-cols-[15rem_1fr]">
      <aside className="border-line bg-panel sticky top-0 z-30 border-b lg:h-svh lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col gap-3 p-3 lg:gap-6 lg:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white uppercase">
              <ShieldCheck className="text-accent size-5" aria-hidden />
              FinTrack Admin
            </p>
            <form action={logout} className="lg:hidden">
              <button className="text-muted flex items-center gap-1.5 text-sm hover:text-white">
                <LogOut className="size-4" aria-hidden /> Esci
              </button>
            </form>
          </div>
          <Nav />
          <div className="border-line mt-auto hidden border-t pt-4 lg:block">
            <p className="truncate text-sm font-medium text-white">{admin.name}</p>
            <p className="text-muted truncate text-xs">{admin.email}</p>
            <form action={logout} className="mt-3">
              <button className="text-muted flex items-center gap-1.5 text-sm hover:text-white">
                <LogOut className="size-4" aria-hidden /> Esci
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl min-w-0 p-4 lg:p-8">{children}</main>
      <Toaster />
    </div>
  );
}
