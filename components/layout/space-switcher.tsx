"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Settings, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchSpace } from "@/app/(dashboard)/settings/space-actions";
import type { Space } from "@/lib/auth/session";

type Props = { current: string; spaces: Space["spaces"] };

/**
 * Shown when the user belongs to more than one space, or shares their own: which finances
 * they're looking at must always be clear.
 */
export function SpaceSwitcher({ current, spaces }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const active = spaces.find((s) => s.id === current);
  if (!active || (spaces.length === 1 && active.memberCount === 1)) return null;

  async function choose(id: string) {
    if (id === current) return;
    setPending(true);
    const res = await switchSpace(id).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      toast.error(res?.error ?? "Non sono riuscito a cambiare spazio.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (spaces.length === 1) {
    return (
      <Link
        href="/settings"
        className="text-muted-foreground hover:text-foreground hover:bg-muted flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm"
        title={`Spazio condiviso: ${active.name}`}
        aria-label={`Spazio condiviso: ${active.name}`}
      >
        <Users className="size-4 shrink-0" aria-hidden />
        {/* Next to the desktop menu there's no room for the name: the tooltip has it. */}
        <span className="hidden max-w-32 truncate sm:inline lg:hidden">{active.name}</span>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="text-muted-foreground hover:text-foreground hover:bg-muted flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm outline-none disabled:opacity-60"
        aria-label={`Spazio: ${active.name}. Cambia spazio`}
        title={`Spazio: ${active.name}`}
      >
        <Users className="size-4 shrink-0" aria-hidden />
        <span className="hidden max-w-32 truncate sm:inline lg:hidden">{active.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>I tuoi spazi</DropdownMenuLabel>
          {spaces.map((s) => (
            <DropdownMenuItem key={s.id} onClick={() => choose(s.id)}>
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="text-muted-foreground text-xs">
                {s.memberCount > 1 ? `${s.memberCount} persone` : "solo tu"}
              </span>
              {s.id === current && <Check />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings /> Gestisci spazio
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
