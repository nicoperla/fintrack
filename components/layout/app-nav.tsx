"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BadgeEuro,
  Calculator,
  ChevronDown,
  Coffee,
  Ellipsis,
  FileText,
  Flag,
  FolderHeart,
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
  TrendingUp,
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
  { href: "/stipendio-vero", label: "Stipendio vero", icon: BadgeEuro },
  { href: "/investments", label: "Investimenti", icon: TrendingUp },
  { href: "/ritrovati", label: "Soldi ritrovati", icon: HandCoins },
  { href: "/split", label: "Conti chiari", icon: Handshake },
  { href: "/caffe", label: "Il caffè dei conti", icon: Coffee },
  { href: "/stories", label: "Il mese in storie", icon: GalleryVerticalEnd },
  { href: "/recurring", label: "Abbonamenti", icon: Repeat },
  { href: "/simulator", label: "Simulatore", icon: Calculator },
  { href: "/debts", label: "Piano debiti", icon: Landmark },
  { href: "/fascicolo", label: "Fascicolo di famiglia", icon: FolderHeart },
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

/**
 * Where the active item of a horizontal menu is, so a pill can slide to it. Measured after
 * every navigation and whenever the menu changes size (e.g. when the fonts arrive).
 */
function useActiveBox(navRef: RefObject<HTMLElement>, key: string) {
  const [box, setBox] = useState<{ x: number; width: number } | null>(null);
  // No slide on the first placement: the pill appears where it belongs.
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLElement>("[data-active]");
      setBox(active ? { x: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [navRef, key]);

  useEffect(() => {
    if (!box || animate) return;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [box, animate]);

  return { box, animate };
}

export function DesktopNav() {
  const pathname = usePathname();
  const isActive = useIsActive();
  const toolsActive = TOOLS.some((item) => isActive(item.href));
  const navRef = useRef<HTMLElement>(null);
  const { box, animate } = useActiveBox(navRef, pathname);
  const linkClass = (active: boolean) =>
    cn(
      "relative z-10 flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors",
      active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <nav ref={navRef} aria-label="Menu principale" className="relative hidden items-center lg:flex">
      {/* The pill behind the active item, with a beam of light on the header's edge under it. */}
      <span
        aria-hidden
        className={cn(
          "bg-foreground/[0.06] ring-foreground/10 pointer-events-none absolute inset-y-0 left-0 rounded-full ring-1",
          "after:absolute after:inset-x-2 after:-bottom-3 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-indigo-400 after:via-fuchsia-400 after:to-cyan-300 after:shadow-[0_0_14px_rgba(167,139,250,0.95)]",
          box ? "opacity-100" : "opacity-0",
          animate &&
            "transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        )}
        style={box ? { width: box.width, transform: `translateX(${box.x}px)` } : undefined}
      />
      {PRIMARY.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            data-active={active || undefined}
            className={linkClass(active)}
          >
            {item.label}
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger
          data-active={toolsActive || undefined}
          className={linkClass(toolsActive)}
        >
          Strumenti
          <ChevronDown className="size-3.5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <MenuItems items={TOOLS} />
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

const dockItemClass = (active: boolean) =>
  cn(
    "relative z-10 flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] transition-colors",
    active ? "text-foreground font-medium" : "text-muted-foreground",
  );

const dockIconClass = (active: boolean) =>
  cn(
    "size-5 transition-[color,filter,transform] duration-300",
    active &&
      "-translate-y-px text-indigo-600 drop-shadow-[0_0_8px_rgba(129,140,248,0.7)] dark:text-indigo-300",
  );

/** Phones: a floating glass dock, with a glowing tab that slides to the current page. */
export function MobileNav() {
  const isActive = useIsActive();
  const barItems = PRIMARY.filter((item) => MOBILE_BAR.includes(item.href));
  const moreActive = MOBILE_MORE.some((item) => isActive(item.href));
  const found = barItems.findIndex((item) => isActive(item.href));
  const index = found >= 0 ? found : moreActive ? barItems.length : -1;

  return (
    <nav
      aria-label="Menu principale"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 lg:hidden"
    >
      <div className="bg-background/75 supports-backdrop-filter:bg-background/55 relative grid grid-cols-5 rounded-2xl border p-1 shadow-[0_18px_40px_-18px_rgb(30_27_75/0.45)] backdrop-blur-xl backdrop-saturate-150 dark:shadow-[0_18px_44px_-16px_rgb(0_0_0/0.95)]">
        {index >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/5)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateX(${index * 100}%)` }}
          >
            <span className="absolute inset-0 rounded-xl bg-gradient-to-b from-indigo-500/15 to-fuchsia-500/[0.08] ring-1 ring-indigo-400/25" />
            <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-300 shadow-[0_0_10px_rgba(167,139,250,0.9)]" />
          </span>
        )}
        {barItems.map(({ href, label, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={dockItemClass(active)}
            >
              <Icon className={dockIconClass(active)} />
              {short ?? label}
            </Link>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger className={dockItemClass(moreActive)}>
            <Ellipsis className={dockIconClass(moreActive)} />
            Altro
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" sideOffset={10} className="w-52">
            <MenuItems items={MOBILE_MORE} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
