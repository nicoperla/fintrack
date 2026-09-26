import { renderIcon } from "@/lib/pwa/icon";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself: a full-bleed icon avoids a double border.
export default function AppleIcon() {
  return renderIcon(180, { maskable: true });
}
