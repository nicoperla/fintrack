import { createHmac, timingSafeEqual } from "crypto";
import { getAppUrl } from "@/lib/app-url";

// Unsubscribe links must work without logging in, so they carry an HMAC of the user id
// instead of a session: nobody can switch off someone else's digest by guessing ids.
function sign(userId: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET non configurata");
  return createHmac("sha256", secret).update(`weekly-digest:${userId}`).digest("base64url");
}

export function verifyUnsubscribeToken(userId: string, token: string) {
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(userId: string) {
  const params = new URLSearchParams({ u: userId, t: sign(userId) });
  return `${getAppUrl()}/api/digest/unsubscribe?${params}`;
}
