import { cn } from "@/lib/utils";

/*
 * Small spot illustrations for empty states. They only use theme tokens (card, muted, border,
 * foreground and the two data-viz accents), so they follow light and dark mode automatically.
 */

const INK = "color-mix(in oklch, var(--foreground) 22%, transparent)";
const LINE = "color-mix(in oklch, var(--foreground) 12%, transparent)";
const ACCENT = "var(--viz-income)";
const ACCENT_2 = "var(--viz-expense)";
const SOFT = (c: string, pct: number) => `color-mix(in oklch, ${c} ${pct}%, transparent)`;

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      role="presentation"
      aria-hidden
      className={cn("h-28 w-auto motion-safe:animate-[float_6s_ease-in-out_infinite]", className)}
    >
      <ellipse cx="80" cy="64" rx="62" ry="46" fill="var(--muted)" />
      <ellipse cx="80" cy="110" rx="38" ry="4" fill={LINE} />
      {children}
    </svg>
  );
}

const Wallet = () => (
  <Frame>
    <rect
      x="46"
      y="30"
      width="58"
      height="36"
      rx="6"
      fill={SOFT(ACCENT_2, 30)}
      transform="rotate(-8 75 48)"
    />
    <rect
      x="50"
      y="34"
      width="58"
      height="36"
      rx="6"
      fill={SOFT(ACCENT, 35)}
      transform="rotate(-3 79 52)"
    />
    <rect
      x="40"
      y="46"
      width="80"
      height="52"
      rx="10"
      fill="var(--card)"
      stroke={INK}
      strokeWidth="1.5"
    />
    <path d="M40 58h80" stroke={LINE} strokeWidth="1.5" />
    <rect
      x="96"
      y="66"
      width="30"
      height="18"
      rx="6"
      fill="var(--card)"
      stroke={INK}
      strokeWidth="1.5"
    />
    <circle cx="107" cy="75" r="3.5" fill={ACCENT} />
    <circle cx="124" cy="36" r="9" fill={SOFT(ACCENT_2, 70)} />
    <path d="M121 36h6M124 33v6" stroke="var(--card)" strokeWidth="1.8" strokeLinecap="round" />
  </Frame>
);

const Receipts = () => (
  <Frame>
    <path
      d="M56 26h40v70l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4z"
      fill={SOFT(ACCENT, 25)}
      transform="rotate(-10 76 60)"
    />
    <path
      d="M62 22h44v76l-5.5-4-5.5 4-5.5-4-5.5 4-5.5-4-5.5 4-5.5-4-5.5 4z"
      fill="var(--card)"
      stroke={INK}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M70 36h28M70 46h20M70 56h24M70 66h16"
      stroke={LINE}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path d="M70 78h14" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
    <path d="M92 78h6" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    <circle cx="116" cy="84" r="12" fill={SOFT(ACCENT_2, 75)} />
    <path d="M112 84h8M116 80v8" stroke="var(--card)" strokeWidth="2" strokeLinecap="round" />
  </Frame>
);

const Target = () => (
  <Frame>
    <circle cx="76" cy="62" r="34" fill="var(--card)" stroke={INK} strokeWidth="1.5" />
    <circle cx="76" cy="62" r="23" fill={SOFT(ACCENT, 20)} />
    <circle cx="76" cy="62" r="12" fill={SOFT(ACCENT, 45)} />
    <circle cx="76" cy="62" r="4" fill={ACCENT} />
    <path d="M76 62l40-30" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    <path d="M110 30l10-2-2 10z" fill={ACCENT_2} />
    <path d="M113 37l7 1M116 33l1 7" stroke={ACCENT_2} strokeWidth="2" strokeLinecap="round" />
  </Frame>
);

const Mountain = () => (
  <Frame>
    <circle cx="116" cy="34" r="10" fill={SOFT(ACCENT_2, 60)} />
    <path
      d="M26 100l34-44 18 22 16-18 40 40z"
      fill="var(--card)"
      stroke={INK}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M60 56l-8 10 8-3 6 5z" fill={SOFT(ACCENT, 30)} />
    <path d="M94 60l-6 7 6-2 5 4z" fill={SOFT(ACCENT, 30)} />
    <path d="M60 56V30" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    <path d="M60 30h18l-5 6 5 6H60z" fill={ACCENT} />
    <path
      d="M40 90c10-4 18 4 28 0s18-6 30 0 20 2 28-2"
      stroke={LINE}
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
  </Frame>
);

const Search = () => (
  <Frame>
    <rect
      x="40"
      y="28"
      width="54"
      height="66"
      rx="8"
      fill="var(--card)"
      stroke={INK}
      strokeWidth="1.5"
    />
    <path
      d="M50 42h32M50 52h24M50 62h28M50 72h18"
      stroke={LINE}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <circle cx="96" cy="66" r="18" fill={SOFT(ACCENT, 18)} stroke={ACCENT} strokeWidth="3" />
    <path d="M109 79l14 14" stroke={ACCENT} strokeWidth="5" strokeLinecap="round" />
    <path d="M90 60l12 12M102 60L90 72" stroke={ACCENT_2} strokeWidth="2.5" strokeLinecap="round" />
  </Frame>
);

const Calendar = () => (
  <Frame>
    <rect
      x="42"
      y="30"
      width="72"
      height="64"
      rx="9"
      fill="var(--card)"
      stroke={INK}
      strokeWidth="1.5"
    />
    <path d="M42 44h72" stroke={INK} strokeWidth="1.5" />
    <rect x="42" y="30" width="72" height="14" rx="9" fill={SOFT(ACCENT, 35)} />
    <path d="M58 24v12M98 24v12" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    {[0, 1, 2, 3].map((c) =>
      [0, 1, 2].map((r) => (
        <rect
          key={`${c}-${r}`}
          x={52 + c * 14}
          y={52 + r * 12}
          width="8"
          height="7"
          rx="2"
          fill={c === 2 && r === 1 ? ACCENT : LINE}
        />
      )),
    )}
    <circle cx="118" cy="86" r="13" fill="var(--card)" stroke={ACCENT_2} strokeWidth="2" />
    <path
      d="M112 86a6 6 0 0110-4.5M124 86a6 6 0 01-10 4.5"
      stroke={ACCENT_2}
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M122 78v4h-4M114 94v-4h4"
      stroke={ACCENT_2}
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Frame>
);

const Chart = () => (
  <Frame>
    <rect
      x="36"
      y="30"
      width="88"
      height="64"
      rx="9"
      fill="var(--card)"
      stroke={INK}
      strokeWidth="1.5"
    />
    <path d="M46 82h68" stroke={LINE} strokeWidth="1.5" />
    <rect x="52" y="62" width="10" height="20" rx="3" fill={SOFT(ACCENT, 40)} />
    <rect x="68" y="52" width="10" height="30" rx="3" fill={SOFT(ACCENT, 60)} />
    <rect x="84" y="58" width="10" height="24" rx="3" fill={SOFT(ACCENT, 40)} />
    <rect x="100" y="42" width="10" height="40" rx="3" fill={ACCENT} />
    <path d="M122 24l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill={ACCENT_2} />
  </Frame>
);

const Celebrate = () => (
  <Frame>
    <path
      d="M52 98l18-50 32 32z"
      fill="var(--card)"
      stroke={INK}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M60 76l10 10M65 62l18 18"
      stroke={SOFT(ACCENT, 60)}
      strokeWidth="4"
      strokeLinecap="round"
    />
    <path
      d="M86 40c6-10 16-10 20-4M100 60c10-2 16 4 16 12"
      stroke={ACCENT}
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="112" cy="36" r="4" fill={ACCENT_2} />
    <circle cx="124" cy="52" r="3" fill={ACCENT} />
    <rect
      x="92"
      y="24"
      width="6"
      height="6"
      rx="1.5"
      fill={ACCENT_2}
      transform="rotate(20 95 27)"
    />
    <rect
      x="118"
      y="72"
      width="6"
      height="6"
      rx="1.5"
      fill={SOFT(ACCENT_2, 70)}
      transform="rotate(-15 121 75)"
    />
    <circle cx="78" cy="34" r="3" fill={SOFT(ACCENT, 70)} />
  </Frame>
);

export const ILLUSTRATIONS = {
  wallet: Wallet,
  receipts: Receipts,
  target: Target,
  mountain: Mountain,
  search: Search,
  calendar: Calendar,
  chart: Chart,
  celebrate: Celebrate,
};

export type IllustrationName = keyof typeof ILLUSTRATIONS;

export function Illustration({ name }: { name: IllustrationName }) {
  const Component = ILLUSTRATIONS[name];
  return <Component />;
}
