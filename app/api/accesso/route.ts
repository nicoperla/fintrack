import { NextResponse } from "next/server";
import {
  codeMatches,
  GATE_COOKIE,
  GATE_PAGE,
  gateEnabled,
  issuePass,
  PASS_MAX_AGE,
  safeNext,
} from "@/lib/gate";
import { clientIp, rateLimit, RULES } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Back to the gate page with what went wrong (a plain form post: it works without JavaScript). */
function back(request: Request, error: "codice" | "troppi", next: string) {
  const url = new URL(GATE_PAGE, request.url);
  url.searchParams.set("errore", error);
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url, 303);
}

// POST /api/accesso: checks the pre-launch access code and hands out the pass (lib/gate.ts).
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back(request, "codice", "/");
  }
  const next = safeNext(String(form.get("next") ?? ""));
  if (!gateEnabled()) return NextResponse.redirect(new URL(next, request.url), 303);

  // Counted before checking the code, right or wrong.
  const limit = await rateLimit(`gate:ip:${clientIp()}`, RULES.gate);
  if (!limit.ok) return back(request, "troppi", next);

  if (!(await codeMatches(String(form.get("code") ?? "")))) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return back(request, "codice", next);
  }

  const res = NextResponse.redirect(new URL(next, request.url), 303);
  res.cookies.set(GATE_COOKIE, await issuePass(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PASS_MAX_AGE,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
