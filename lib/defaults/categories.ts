// Starter categories: used by the demo seed and offered during onboarding.
export type DefaultCategory = {
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string;
  color: string;
  children?: { name: string; icon: string }[];
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: "Casa",
    type: "EXPENSE",
    icon: "home",
    color: "#6366f1",
    children: [
      { name: "Affitto", icon: "key-round" },
      { name: "Bollette", icon: "zap" },
      { name: "Manutenzione", icon: "wrench" },
    ],
  },
  {
    name: "Spesa",
    type: "EXPENSE",
    icon: "shopping-cart",
    color: "#22c55e",
    children: [{ name: "Supermercato", icon: "store" }],
  },
  {
    name: "Trasporti",
    type: "EXPENSE",
    icon: "car",
    color: "#f59e0b",
    children: [
      { name: "Carburante", icon: "fuel" },
      { name: "Trasporto pubblico", icon: "train-front" },
    ],
  },
  {
    name: "Ristoranti e bar",
    type: "EXPENSE",
    icon: "utensils",
    color: "#ef4444",
    children: [
      { name: "Ristoranti", icon: "utensils-crossed" },
      { name: "Bar e caffè", icon: "coffee" },
    ],
  },
  {
    name: "Abbonamenti",
    type: "EXPENSE",
    icon: "repeat",
    color: "#a855f7",
    children: [
      { name: "Streaming", icon: "tv" },
      { name: "Palestra", icon: "dumbbell" },
      { name: "Telefono e internet", icon: "wifi" },
    ],
  },
  {
    name: "Svago",
    type: "EXPENSE",
    icon: "gamepad-2",
    color: "#ec4899",
    children: [
      { name: "Cinema e eventi", icon: "clapperboard" },
      { name: "Hobby", icon: "palette" },
    ],
  },
  { name: "Salute", type: "EXPENSE", icon: "heart-pulse", color: "#14b8a6" },
  { name: "Shopping", type: "EXPENSE", icon: "shopping-bag", color: "#f97316" },
  { name: "Stipendio", type: "INCOME", icon: "briefcase", color: "#16a34a" },
  { name: "Rimborsi", type: "INCOME", icon: "undo-2", color: "#0ea5e9" },
  { name: "Altre entrate", type: "INCOME", icon: "plus-circle", color: "#84cc16" },
];
