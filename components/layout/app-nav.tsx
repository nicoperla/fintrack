"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Ellipsis,
  Flag,
  LayoutDashboard,
  Lightbulb,
  Tags,
  Target,
  Upload,
  Wallet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Transazioni", short: "Movimenti", icon: ArrowLeftRight },
  { href: "/accounts", label: "Conti", short: "Conti", icon: Wallet },
  { href: "/categories", label: "Categorie", short: "Categorie", icon: Tags },
  { href: "/budgets", label: "Budget", short: "Budget", icon: Target },
  { href: "/goals", label: "Obiettivi", short: "Obiettivi", icon: Flag },
  { href: "/insights", label: "Analisi", short: "Analisi", icon: Lightbulb },
];

const MOBILE_PRIMARY = ["/dashboard", "/transactions", "/budgets", "/goals"];
const MOBILE_MORE = [
  { href: "/insights", label: "Analisi", icon: Lightbulb },
  { href: "/accounts", label: "Conti", icon: Wallet },
  { href: "/categories", label: "Categorie", icon: Tags },
  { href: "/transactions/import", label: "Importa CSV", icon: Upload },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav() {
  const isActive = useIsActive();
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-muted rounded-md px-3 py-1.5 text-sm transition-colors",
            isActive(item.href) && "text-foreground bg-muted font-medium",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

const mobileItemClass = (active: boolean) =>
  cn(
    "text-muted-foreground flex flex-col items-center gap-1 py-2 text-[11px]",
    active && "text-foreground font-medium",
  );

export function MobileNav() {
  const isActive = useIsActive();
  const router = useRouter();
  const moreActive = MOBILE_MORE.some((item) => isActive(item.href));

  return (
    <nav className="bg-background/95 supports-backdrop-filter:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {NAV_ITEMS.filter((item) => MOBILE_PRIMARY.includes(item.href)).map(
          ({ href, short, icon: Icon }) => {
            // "/transactions/import" lives under "Altro", not under "Movimenti".
            const active = isActive(href) && !(href === "/transactions" && moreActive);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={mobileItemClass(active)}
              >
                <Icon className="size-5" />
                {short}
              </Link>
            );
          },
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className={mobileItemClass(moreActive)}>
            <Ellipsis className="size-5" />
            Altro
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-44">
            {MOBILE_MORE.map(({ href, label, icon: Icon }) => (
              <DropdownMenuItem key={href} onClick={() => router.push(href)}>
                <Icon />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
