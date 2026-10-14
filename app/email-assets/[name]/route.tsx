import { renderEmailAsset } from "@/lib/emails/assets";

// /email-assets/hero-violet.png, logo.png, stars.png…: the pictures linked from the emails.
// The edge runtime is also what lets next/og load its font when building on Windows.
export const runtime = "edge";

export function GET(_request: Request, { params }: { params: { name: string } }) {
  return renderEmailAsset(params.name) ?? new Response("Not found", { status: 404 });
}
