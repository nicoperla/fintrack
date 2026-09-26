import { ImageResponse } from "next/og";

/**
 * The app icon: the FinTrack "F" with the brand's blue dot. `maskable` icons get a full-bleed
 * background and keep the mark inside the central safe zone (Android crops them to a shape).
 */
export function renderIcon(size: number, { maskable = false } = {}) {
  const mark = size * (maskable ? 0.5 : 0.62);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#171717",
        borderRadius: maskable ? 0 : size * 0.22,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: mark * 0.04 }}>
        <span
          style={{
            color: "#fafafa",
            fontSize: mark,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: -mark * 0.04,
          }}
        >
          F
        </span>
        <span
          style={{
            width: mark * 0.2,
            height: mark * 0.2,
            borderRadius: "50%",
            background: "#3987e5",
            marginBottom: mark * 0.1,
          }}
        />
      </div>
    </div>,
    { width: size, height: size },
  );
}
