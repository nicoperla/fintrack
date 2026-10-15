import type { MetadataRoute } from "next";
import { gateEnabled } from "@/lib/gate";

// While the pre-launch gate is up (lib/gate.ts) search engines are asked to stay out entirely.
export default function robots(): MetadataRoute.Robots {
  return gateEnabled()
    ? { rules: { userAgent: "*", disallow: "/" } }
    : { rules: { userAgent: "*", allow: "/" } };
}
