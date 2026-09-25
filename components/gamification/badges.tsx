import {
  Award,
  CalendarCheck,
  Flame,
  Footprints,
  Lock,
  PiggyBank,
  ShieldCheck,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Badge, BadgeId } from "@/lib/gamification/engine";
import { cn } from "@/lib/utils";

export const BADGE_ICONS: Record<BadgeId, LucideIcon> = {
  "first-step": Footprints,
  "week-streak": Flame,
  "month-streak": CalendarCheck,
  hundred: Award,
  planner: Target,
  "on-track": ShieldCheck,
  saver: PiggyBank,
  goal: Trophy,
  importer: Zap,
};

// Each badge keeps its own hue so the collection reads as a set, not a status scale.
const BADGE_COLORS: Record<BadgeId, string> = {
  "first-step": "#0ea5e9",
  "week-streak": "#f97316",
  "month-streak": "#ef4444",
  hundred: "#a855f7",
  planner: "#6366f1",
  "on-track": "#14b8a6",
  saver: "#22c55e",
  goal: "#f59e0b",
  importer: "#ec4899",
};

export function BadgeMedal({ badge, size = "md" }: { badge: Badge; size?: "sm" | "md" }) {
  const Icon = badge.unlocked ? BADGE_ICONS[badge.id] : Lock;
  const color = BADGE_COLORS[badge.id];
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "sm" ? "size-8" : "size-12",
        !badge.unlocked && "bg-muted text-muted-foreground",
      )}
      style={
        badge.unlocked
          ? {
              background: `radial-gradient(circle at 30% 25%, ${color}40, ${color}1f 70%)`,
              color,
              boxShadow: `inset 0 0 0 1.5px ${color}66`,
            }
          : undefined
      }
    >
      <Icon className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}
