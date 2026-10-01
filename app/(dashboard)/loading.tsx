import { LogoMark } from "@/components/brand/logo-mark";

/**
 * While a page loads: the logo's moon spins fast over glass placeholders. It fades in after a
 * short delay (.app-loading), so quick navigations don't flash it.
 */
export default function DashboardLoading() {
  return (
    <div className="app-loading grid gap-6" role="status">
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <LogoMark seconds={1.2} />
        Un attimo, sto preparando i numeri…
      </p>
      <div className="app-skeleton h-40 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="app-skeleton h-28 rounded-xl" />
        <div className="app-skeleton h-28 rounded-xl" />
        <div className="app-skeleton h-28 rounded-xl" />
      </div>
      <div className="app-skeleton h-64 rounded-xl" />
    </div>
  );
}
