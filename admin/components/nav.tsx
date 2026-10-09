"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Gauge,
  History,
  Receipt,
  Server,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";
import { cn } from "@/components/ui";

const LINKS = [
  { href: "/", label: "Panoramica", icon: Gauge },
  { href: "/utenti", label: "Utenti", icon: Users },
  { href: "/abbonamenti", label: "Abbonamenti", icon: CreditCard },
  { href: "/pagamenti", label: "Pagamenti", icon: Receipt },
  { href: "/sicurezza", label: "Sicurezza", icon: ShieldAlert },
  { href: "/registro", label: "Registro", icon: History },
  { href: "/sistema", label: "Sistema", icon: Server },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sezioni" className="flex gap-1 overflow-x-auto lg:grid lg:overflow-visible">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-accent/15 text-accent" : "text-muted hover:bg-raised hover:text-white",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
