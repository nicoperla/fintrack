"use client";

import { AnimatePresence, motion } from "motion/react";
import { LogoMark } from "@/components/brand/logo-mark";
import { STRENGTH_LABELS } from "@/lib/auth/password-rules";
import type { CoachPriority } from "@/lib/finance/coach-profile";
import { PRIORITY_ICONS } from "@/components/register/priorities";
import { STRENGTH_COLORS } from "@/components/register/password-meter";
import { cn } from "@/lib/utils";

/**
 * The Orbitly card that fills in while the user signs up: the name and the email as they're
 * typed, the password's strength, the priorities picked. A recap of each answer at a glance,
 * so it's hidden from screen readers (the fields say the same).
 */
export function MemberPass({
  name,
  email,
  strength,
  priorities,
}: {
  name: string;
  email: string;
  strength: number;
  priorities: CoachPriority[];
}) {
  const shownName = name.trim();
  const initial = shownName ? shownName[0].toUpperCase() : "";

  return (
    <div
      aria-hidden
      className="app-sheen relative overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgb(79_70_229/0.38),rgb(124_58_237/0.22)_55%,rgb(162_28_175/0.3))] p-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_12px_32px_-16px_rgb(124_58_237/0.7)]"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-300 via-violet-400 to-fuchsia-500 text-base font-semibold text-white shadow-[0_0_18px_rgba(167,139,250,0.55)]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={initial || "empty"}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
            >
              {initial || "?"}
            </motion.span>
          </AnimatePresence>
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium", !shownName && "text-white/35")}>
            {shownName || "Il tuo nome"}
          </p>
          <p className={cn("truncate text-xs", email.trim() ? "text-white/70" : "text-white/30")}>
            {email.trim() || "la tua email"}
          </p>
        </div>
        <LogoMark className="text-white" />
      </div>

      <div className="mt-3 flex min-h-5 items-center justify-between gap-3 text-[11px] text-white/60">
        <div className="flex items-center gap-2">
          <span className="flex gap-0.5">
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={cn(
                  "h-1.5 w-4 rounded-full transition-colors duration-300",
                  strength >= n ? STRENGTH_COLORS[strength] : "bg-white/15",
                )}
              />
            ))}
          </span>
          <span>
            {strength ? `Sicurezza ${STRENGTH_LABELS[strength].toLowerCase()}` : "Sicurezza"}
          </span>
        </div>
        <span className="flex -space-x-1.5">
          <AnimatePresence initial={false}>
            {priorities.map((p) => {
              const Icon = PRIORITY_ICONS[p];
              return (
                <motion.span
                  key={p}
                  layout
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 26 }}
                  className="flex size-5 items-center justify-center rounded-full border border-white/20 bg-violet-950/80 text-violet-200"
                >
                  <Icon className="size-3" />
                </motion.span>
              );
            })}
          </AnimatePresence>
        </span>
      </div>
    </div>
  );
}
