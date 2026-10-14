import { ImageResponse } from "next/og";
import { EMAIL_TONES, type EmailTone } from "@/lib/emails/layout";

/*
 * The pictures in Orbitly's emails, drawn like the app icon (lib/pwa/icon.tsx) and served from
 * /email-assets/<name>.png: the banner at the top of each email (a planet on its orbit in the
 * night sky of the landing page, coloured by the kind of email), the logo and a star tile for
 * the background. Emails link them with absolute URLs, so they must stay public.
 */

const PALETTE: Record<
  EmailTone,
  { planet: string; glow: string; nebulaA: string; nebulaB: string; moon: string }
> = {
  violet: {
    planet: "linear-gradient(135deg, #e0e7ff 0%, #a78bfa 45%, #d946ef 100%)",
    glow: "rgba(167, 139, 250, 0.8)",
    nebulaA: "rgba(79, 70, 229, 0.55)",
    nebulaB: "rgba(192, 38, 211, 0.38)",
    moon: "#67e8f9",
  },
  amber: {
    planet: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 50%, #f97316 100%)",
    glow: "rgba(251, 191, 36, 0.65)",
    nebulaA: "rgba(180, 83, 9, 0.5)",
    nebulaB: "rgba(124, 58, 237, 0.32)",
    moon: "#fde68a",
  },
  emerald: {
    planet: "linear-gradient(135deg, #d1fae5 0%, #34d399 50%, #0ea5e9 100%)",
    glow: "rgba(52, 211, 153, 0.65)",
    nebulaA: "rgba(5, 150, 105, 0.45)",
    nebulaB: "rgba(79, 70, 229, 0.38)",
    moon: "#a5f3fc",
  },
  rose: {
    planet: "linear-gradient(135deg, #ffe4e6 0%, #fb7185 50%, #be123c 100%)",
    glow: "rgba(251, 113, 133, 0.65)",
    nebulaA: "rgba(190, 18, 60, 0.45)",
    nebulaB: "rgba(124, 58, 237, 0.38)",
    moon: "#fecdd3",
  },
};

/** The same sky every time: a seeded generator instead of Math.random. */
function stars(count: number, width: number, height: number, seed: number) {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const big = next() > 0.88;
    return {
      x: Math.round(next() * width),
      y: Math.round(next() * height),
      size: big ? 3 + next() * 2 : 1.2 + next() * 1.6,
      opacity: 0.35 + next() * 0.6,
      color: next() > 0.8 ? "#a5f3fc" : next() > 0.7 ? "#c7d2fe" : "#ffffff",
    };
  });
}

const dot = (star: ReturnType<typeof stars>[number], key: number) => (
  <div
    key={key}
    style={{
      position: "absolute",
      left: star.x,
      top: star.y,
      width: star.size,
      height: star.size,
      borderRadius: "50%",
      background: star.color,
      opacity: star.opacity,
    }}
  />
);

const glow = (left: number, top: number, size: number, color: string) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width: size,
      height: size * 0.75,
      borderRadius: "50%",
      backgroundImage: `radial-gradient(circle, ${color} 0%, rgba(0, 0, 0, 0) 70%)`,
    }}
  />
);

/** 1200×440, shown at 600×220: the planet and its moon on the right, the card's colour below. */
function hero(tone: EmailTone) {
  const p = PALETTE[tone];
  const W = 1200;
  const H = 440;
  // The orbit: an ellipse around the planet, tilted like the one on the landing page.
  const cx = 820;
  const cy = 205;
  const a = 300;
  const b = 88;
  const tilt = (-14 * Math.PI) / 180;
  const at = (-38 * Math.PI) / 180;
  const moonX = cx + a * Math.cos(at) * Math.cos(tilt) - b * Math.sin(at) * Math.sin(tilt);
  const moonY = cy + a * Math.cos(at) * Math.sin(tilt) + b * Math.sin(at) * Math.cos(tilt);
  const planet = 196;
  const moon = 30;

  return (
    <div
      style={{
        position: "relative",
        width: W,
        height: H,
        display: "flex",
        background: "#0b0b1a",
        overflow: "hidden",
      }}
    >
      {glow(-120, -160, 900, p.nebulaA)}
      {glow(560, 40, 760, p.nebulaB)}
      {glow(200, 180, 520, "rgba(34, 211, 238, 0.12)")}
      {stars(110, W, H, 20261014 + tone.length).map(dot)}
      {/* A shooting star crossing the top left. */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 70,
          width: 220,
          height: 2,
          borderRadius: 2,
          backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0) 0%, #ffffff 100%)",
          transform: "rotate(-18deg)",
        }}
      />
      {/* A small far planet, for depth. */}
      <div
        style={{
          position: "absolute",
          left: 250,
          top: 250,
          width: 34,
          height: 34,
          borderRadius: "50%",
          backgroundImage: "linear-gradient(135deg, #818cf8 0%, #22d3ee 100%)",
          opacity: 0.75,
          boxShadow: "0 0 24px rgba(34, 211, 238, 0.6)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: cx - a,
          top: cy - b,
          width: a * 2,
          height: b * 2,
          borderRadius: "50%",
          border: "3px solid rgba(199, 210, 254, 0.32)",
          transform: "rotate(-14deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: cx - planet / 2,
          top: cy - planet / 2,
          width: planet,
          height: planet,
          borderRadius: "50%",
          backgroundImage: p.planet,
          boxShadow: `0 0 110px 18px ${p.glow}`,
        }}
      />
      {/* The light side of the planet: a soft highlight up and left. */}
      <div
        style={{
          position: "absolute",
          left: cx - planet / 2 + 30,
          top: cy - planet / 2 + 24,
          width: 70,
          height: 50,
          borderRadius: "50%",
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: moonX - moon / 2,
          top: moonY - moon / 2,
          width: moon,
          height: moon,
          borderRadius: "50%",
          background: p.moon,
          boxShadow: `0 0 28px ${p.moon}`,
        }}
      />
      {/* Fades into the email card below the picture. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: H - 170,
          width: W,
          height: 170,
          backgroundImage: "linear-gradient(180deg, rgba(13,13,29,0) 0%, #0d0d1d 100%)",
        }}
      />
    </div>
  );
}

/** The mark next to the name in the header: transparent, for the dark background. */
function logo() {
  return (
    <div
      style={{
        position: "relative",
        width: 96,
        height: 96,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 6,
          top: 6,
          width: 84,
          height: 84,
          borderRadius: "50%",
          border: "4px solid rgba(199, 210, 254, 0.35)",
        }}
      />
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          backgroundImage: "linear-gradient(135deg, #a5b4fc 0%, #a78bfa 50%, #d946ef 100%)",
          boxShadow: "0 0 22px rgba(167, 139, 250, 0.9)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 66,
          top: 10,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#67e8f9",
          boxShadow: "0 0 10px #67e8f9",
        }}
      />
    </div>
  );
}

/** A tile of faint stars repeated behind the whole email (where clients show backgrounds). */
function starTile() {
  return (
    <div
      style={{
        position: "relative",
        width: 600,
        height: 600,
        display: "flex",
        background: "#05050c",
      }}
    >
      {stars(70, 600, 600, 7).map((s, i) => dot({ ...s, opacity: s.opacity * 0.55 }, i))}
    </div>
  );
}

const ASSETS: Record<string, () => ImageResponse> = {
  "logo.png": () => new ImageResponse(logo(), { width: 96, height: 96 }),
  "stars.png": () => new ImageResponse(starTile(), { width: 600, height: 600 }),
  ...Object.fromEntries(
    EMAIL_TONES.map((tone) => [
      `hero-${tone}.png`,
      () => new ImageResponse(hero(tone), { width: 1200, height: 440 }),
    ]),
  ),
};

export function renderEmailAsset(name: string) {
  return ASSETS[name]?.() ?? null;
}
