import { renderIcon } from "@/lib/pwa/icon";

// /icons/192.png, /icons/512.png, /icons/maskable-512.png. ImageResponse sends long-lived cache
// headers; the edge runtime is also what lets next/og load its font when building on Windows.
export const runtime = "edge";

const ICONS: Record<string, { size: number; maskable?: boolean }> = {
  "192.png": { size: 192 },
  "512.png": { size: 512 },
  "maskable-512.png": { size: 512, maskable: true },
};

export function GET(_request: Request, { params }: { params: { name: string } }) {
  const icon = ICONS[params.name];
  if (!icon) return new Response("Not found", { status: 404 });
  return renderIcon(icon.size, { maskable: icon.maskable });
}
