import {
  Baby,
  Bike,
  Book,
  Bus,
  CarFront,
  Cigarette,
  Dices,
  FileText,
  HandCoins,
  HandHeart,
  Hotel,
  Package,
  PawPrint,
  Percent,
  Pill,
  School,
  Scissors,
  ShieldCheck,
  SquareParking,
  Stethoscope,
  Ticket,
  Users,
  Wind,
  Banknote,
  BookOpen,
  Briefcase,
  Car,
  CircleHelp,
  CirclePlus,
  Clapperboard,
  Coffee,
  Dog,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  KeyRound,
  Landmark,
  Laptop,
  type LucideIcon,
  Palette,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  TrainFront,
  TrendingUp,
  Tv,
  Undo2,
  Utensils,
  UtensilsCrossed,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";

// Keys are stored in the database (Category.icon); never rename an existing key.
export const CATEGORY_ICONS = {
  home: House,
  "key-round": KeyRound,
  zap: Zap,
  wrench: Wrench,
  "shopping-cart": ShoppingCart,
  store: Store,
  car: Car,
  fuel: Fuel,
  "train-front": TrainFront,
  plane: Plane,
  utensils: Utensils,
  "utensils-crossed": UtensilsCrossed,
  coffee: Coffee,
  repeat: Repeat,
  tv: Tv,
  wifi: Wifi,
  smartphone: Smartphone,
  dumbbell: Dumbbell,
  "gamepad-2": Gamepad2,
  clapperboard: Clapperboard,
  palette: Palette,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  "shopping-bag": ShoppingBag,
  shirt: Shirt,
  gift: Gift,
  baby: Baby,
  dog: Dog,
  laptop: Laptop,
  sparkles: Sparkles,
  receipt: Receipt,
  briefcase: Briefcase,
  banknote: Banknote,
  "trending-up": TrendingUp,
  "piggy-bank": PiggyBank,
  landmark: Landmark,
  "undo-2": Undo2,
  "plus-circle": CirclePlus,
  cigarette: Cigarette,
  wind: Wind,
  dices: Dices,
  ticket: Ticket,
  "paw-print": PawPrint,
  stethoscope: Stethoscope,
  pill: Pill,
  "shield-check": ShieldCheck,
  "file-text": FileText,
  percent: Percent,
  "hand-heart": HandHeart,
  "hand-coins": HandCoins,
  scissors: Scissors,
  hotel: Hotel,
  "car-front": CarFront,
  "square-parking": SquareParking,
  bus: Bus,
  bike: Bike,
  package: Package,
  school: School,
  book: Book,
  users: Users,
} satisfies Record<string, LucideIcon>;

export type CategoryIconName = keyof typeof CATEGORY_ICONS;
export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS) as CategoryIconName[];

export const CATEGORY_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#64748b",
] as const;

export const DEFAULT_CATEGORY_COLOR = "#64748b";

export function CategoryIcon({
  name,
  color,
  size = "md",
}: {
  name: string | null | undefined;
  color: string | null | undefined;
  size?: "sm" | "md";
}) {
  const Icon: LucideIcon = (name && CATEGORY_ICONS[name as CategoryIconName]) || CircleHelp;
  const tint = color ?? DEFAULT_CATEGORY_COLOR;
  return (
    <span
      aria-hidden
      className={
        size === "sm"
          ? "flex size-7 shrink-0 items-center justify-center rounded-md"
          : "flex size-9 shrink-0 items-center justify-center rounded-lg"
      }
      style={{ backgroundColor: `${tint}1f`, color: tint }}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}
