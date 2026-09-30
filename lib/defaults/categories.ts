// Starter categories: used by the demo seed, offered during onboarding, and suggested on the
// categories page to spaces that don't have them yet (matched by name, never duplicated).
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
      { name: "Manutenzione auto", icon: "car-front" },
      { name: "Parcheggi e pedaggi", icon: "square-parking" },
      { name: "Taxi e sharing", icon: "bike" },
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
      { name: "Cibo a domicilio", icon: "package" },
    ],
  },
  {
    name: "Tabacchi",
    type: "EXPENSE",
    icon: "cigarette",
    color: "#78716c",
    children: [
      { name: "Sigarette", icon: "cigarette" },
      { name: "Svapo e IQOS", icon: "wind" },
      { name: "Lotto e gratta e vinci", icon: "ticket" },
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
      { name: "Scommesse", icon: "dices" },
    ],
  },
  {
    name: "Salute",
    type: "EXPENSE",
    icon: "heart-pulse",
    color: "#14b8a6",
    children: [
      { name: "Farmacia", icon: "pill" },
      { name: "Visite mediche", icon: "stethoscope" },
    ],
  },
  {
    name: "Cura personale",
    type: "EXPENSE",
    icon: "scissors",
    color: "#d946ef",
    children: [
      { name: "Parrucchiere", icon: "scissors" },
      { name: "Cosmetici", icon: "sparkles" },
    ],
  },
  {
    name: "Shopping",
    type: "EXPENSE",
    icon: "shopping-bag",
    color: "#f97316",
    children: [
      { name: "Abbigliamento", icon: "shirt" },
      { name: "Elettronica", icon: "laptop" },
    ],
  },
  {
    name: "Viaggi",
    type: "EXPENSE",
    icon: "plane",
    color: "#0ea5e9",
    children: [
      { name: "Voli e treni", icon: "plane" },
      { name: "Alloggi", icon: "hotel" },
    ],
  },
  {
    name: "Famiglia e figli",
    type: "EXPENSE",
    icon: "baby",
    color: "#fb7185",
    children: [
      { name: "Scuola", icon: "school" },
      { name: "Baby sitter", icon: "users" },
    ],
  },
  {
    name: "Animali",
    type: "EXPENSE",
    icon: "paw-print",
    color: "#a16207",
    children: [
      { name: "Cibo per animali", icon: "dog" },
      { name: "Veterinario", icon: "stethoscope" },
    ],
  },
  {
    name: "Istruzione",
    type: "EXPENSE",
    icon: "graduation-cap",
    color: "#2563eb",
    children: [
      { name: "Libri", icon: "book" },
      { name: "Corsi", icon: "book-open" },
    ],
  },
  { name: "Regali e donazioni", type: "EXPENSE", icon: "gift", color: "#e11d48" },
  {
    name: "Assicurazioni",
    type: "EXPENSE",
    icon: "shield-check",
    color: "#475569",
    children: [
      { name: "Assicurazione auto", icon: "car" },
      { name: "Assicurazione casa e vita", icon: "home" },
    ],
  },
  {
    name: "Tasse e commissioni",
    type: "EXPENSE",
    icon: "file-text",
    color: "#64748b",
    children: [
      { name: "Tasse", icon: "landmark" },
      { name: "Commissioni bancarie", icon: "percent" },
    ],
  },
  { name: "Stipendio", type: "INCOME", icon: "briefcase", color: "#16a34a" },
  { name: "Rimborsi", type: "INCOME", icon: "undo-2", color: "#0ea5e9" },
  { name: "Vendite", type: "INCOME", icon: "hand-coins", color: "#0d9488" },
  { name: "Altre entrate", type: "INCOME", icon: "plus-circle", color: "#84cc16" },
];
