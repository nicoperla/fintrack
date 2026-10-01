"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Calculator,
  ChevronDown,
  Ellipsis,
  FileText,
  Flag,
  GalleryVerticalEnd,
  HandCoins,
  Handshake,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  Repeat,
  Sparkles,
  Tags,
  Target,
  Trophy,
  Upload,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; short?: string };

const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Transazioni", short: "Movimenti", icon: ArrowLeftRight },
  { href: "/accounts", label: "Conti", icon: Wallet },
  { href: "/budgets", label: "Budget", icon: Target },
  { href: "/goals", label: "Obiettivi", icon: Flag },
  { href: "/coach", label: "Coach", icon: Sparkles },
  { href: "/insights", label: "Analisi", icon: Lightbulb },
];

const TOOLS: NavItem[] = [
  { href: "/ritrovati", label: "Soldi ritrovati", icon: HandCoins },
  { href: "/split", label: "Conti chiari", icon: Handshake },
  { href: "/stories", label: "Il mese in storie", icon: GalleryVerticalEnd },
  { href: "/recurring", label: "Abbonamenti", icon: Repeat },
  { href: "/simulator", label: "Simulatore", icon: Calculator },
  { href: "/debts", label: "Piano debiti", icon: Landmark },
  { href: "/categories", label: "Categorie", icon: Tags },
  { href: "/transactions/import", label: "Importa CSV", icon: Upload },
  { href: "/achievements", label: "Traguardi", icon: Trophy },
  { href: "/reports", label: "Report PDF", icon: FileText },
];

const MOBILE_BAR = ["/dashboard", "/transactions", "/coach", "/budgets"];
const MOBILE_MORE = [...PRIMARY.filter((item) => !MOBILE_BAR.includes(item.href)), ...TOOLS];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => {
    // "/transactions/import" belongs to the tools, not to "Transazioni".
    if (href === "/transactions" && pathname.startsWith("/transactions/import")) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

function MenuItems({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const isActive = useIsActive();
  return items.map(({ href, label, icon: Icon }) => (
    <DropdownMenuItem
      key={href}
      onClick={() => router.push(href)}
      className={cn(isActive(href) && "font-medium")}
    >
      <Icon />
      {label}
    </DropdownMenuItem>
  ));
}

export function DesktopNav() {
  const isActive = useIsActive();
  const toolsActive = TOOLS.some((item) => isActive(item.href));
  const linkClass = (active: boolean) =>
    cn(
      "text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors",
      active && "text-foreground bg-muted font-medium",
    );

  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {PRIMARY.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={linkClass(isActive(item.href))}
        >
          {item.label}
        </Link>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger className={linkClass(toolsActive)}>
          Strumenti
          <ChevronDown className="size-3.5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <MenuItems items={TOOLS} />
        </DropdownMenuContent>
      </DropdownMenu>
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
  const moreActive = MOBILE_MORE.some((item) => isActive(item.href));

  return (
    <nav className="bg-background/95 supports-backdrop-filter:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {PRIMARY.filter((item) => MOBILE_BAR.includes(item.href)).map(
          ({ href, label, short, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={mobileItemClass(isActive(href))}
            >
              <Icon className="size-5" />
              {short ?? label}
            </Link>
          ),
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className={mobileItemClass(moreActive)}>
            <Ellipsis className="size-5" />
            Altro
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-48">
            <MenuItems items={MOBILE_MORE} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
