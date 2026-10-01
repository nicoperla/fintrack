import { prisma } from "@/lib/db/prisma";
import { canUseAiCoach } from "@/lib/billing/plan";
import { coachProvider, type CoachProvider } from "@/lib/coach/providers";

/*
 * Whether a user may ask the AI coach, and if not, why: the page shows the matching message and
 * the API enforces the same rules.
 */

export type CoachAccess =
  /** No AI key on the server: only the built-in answers. */
  | { status: "off" }
  /** Billing is on and the user is on the free plan. */
  | { status: "pro"; provider: CoachProvider }
  /** The account's email isn't confirmed yet (stops throwaway accounts using the AI). */
  | { status: "verify"; provider: CoachProvider }
  /** The user hasn't agreed to send a summary of their data to the AI provider. */
  | { status: "consent"; provider: CoachProvider }
  | { status: "ready"; provider: CoachProvider };

export async function getCoachAccess(userId: string): Promise<CoachAccess> {
  const provider = coachProvider();
  if (!provider) return { status: "off" };
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { plan: true, emailVerifiedAt: true, aiConsentAt: true },
  });
  if (!canUseAiCoach(user)) return { status: "pro", provider };
  if (!user.emailVerifiedAt) return { status: "verify", provider };
  if (!user.aiConsentAt) return { status: "consent", provider };
  return { status: "ready", provider };
}

/** Who receives the data, as named in the consent text and the privacy policy. */
export const PROVIDER_NAMES: Record<CoachProvider["id"], string> = {
  anthropic: "Anthropic (Claude, Stati Uniti)",
  groq: "Groq (Stati Uniti)",
};
