import { headers } from "next/headers";

/** The caller's IP on Vercel (first hop of x-forwarded-for), or "unknown". */
export function ipFrom(source: Pick<Headers, "get">) {
  const forwarded = source.get("x-forwarded-for") ?? source.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function clientIp() {
  try {
    return ipFrom(await headers());
  } catch {
    return "unknown";
  }
}
