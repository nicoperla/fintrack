import { renderIcon } from "@/lib/pwa/icon";

export const runtime = "edge";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// The browser tab's icon: the same mark as the installed app.
export default function Icon() {
  return renderIcon(64);
}
