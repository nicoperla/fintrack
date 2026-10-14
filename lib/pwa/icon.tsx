import { ImageResponse } from "next/og";

/**
 * The app icon: the Orbitly mark, a glowing planet with a moon on its orbit, on the night sky
 * of the landing page. `maskable` icons get a full-bleed background and keep the mark inside
 * the central safe zone (Android crops them to a shape).
 */
export function renderIcon(size: number, { maskable = false } = {}) {
  const orbit = size * (maskable ? 0.56 : 0.72);
  const planet = orbit * 0.5;
  const moon = orbit * 0.17;
  const ring = Math.max(1, orbit * 0.035);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "radial-gradient(circle at 30% 25%, #1e1b4b 0%, #05050c 70%)",
        borderRadius: maskable ? 0 : size * 0.22,
      }}
    >
      <div
        style={{
          position: "relative",
          width: orbit,
          height: orbit,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            // next/og doesn't know `inset`: the ring is placed with explicit coordinates.
            position: "absolute",
            top: 0,
            left: 0,
            width: orbit,
            height: orbit,
            borderRadius: "50%",
            border: `${ring}px solid rgba(199, 210, 254, 0.42)`,
          }}
        />
        <div
          style={{
            width: planet,
            height: planet,
            borderRadius: "50%",
            backgroundImage: "linear-gradient(135deg, #a5b4fc 0%, #a78bfa 50%, #d946ef 100%)",
            boxShadow: `0 0 ${planet * 0.45}px rgba(167, 139, 250, 0.85)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: orbit * 0.06,
            right: orbit * 0.06,
            width: moon,
            height: moon,
            borderRadius: "50%",
            background: "#67e8f9",
            boxShadow: `0 0 ${moon * 0.8}px #67e8f9`,
          }}
        />
      </div>
    </div>,
    { width: size, height: size },
  );
}
