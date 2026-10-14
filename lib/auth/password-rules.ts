import { PASSWORD_MIN } from "@/lib/validations/auth";

/*
 * The checks on a new password that need no server. The sign-up form ticks them off while the
 * user types; lib/auth/password-policy.ts runs the same ones (plus the data-breach lookup) and
 * has the last word.
 */

type Who = { email?: string | null; name?: string | null };

export const PASSWORD_MAX = 72;
export const MIN_DISTINCT_CHARS = 5;

/** The app's names, today's and the one before: the first words anyone would try. */
const APP_NAMES = ["orbitly", "fintrack"];

/** Which personal detail the password repeats: the email (or the app's name), the first name. */
export function personalPart(password: string, { email, name }: Who = {}) {
  const lower = password.toLowerCase();
  const local = email?.split("@")[0]?.toLowerCase();
  if (
    (local && local.length >= 4 && lower.includes(local)) ||
    APP_NAMES.some((app) => lower.includes(app))
  ) {
    return "email" as const;
  }
  const first = name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (first && first.length >= 4 && lower.includes(first)) return "name" as const;
  return null;
}

export const distinctChars = (password: string) => new Set(password.toLowerCase()).size;

/** Why the password breaks a rule, beyond the length (checked by the schema), or null. */
export function passwordRuleProblem(password: string, who: Who = {}) {
  const personal = personalPart(password, who);
  if (personal === "email") return "Non usare la tua email o il nome dell'app nella password";
  if (personal === "name") return "Non usare il tuo nome nella password";
  if (distinctChars(password) < MIN_DISTINCT_CHARS) {
    return "Troppo prevedibile: usa più caratteri diversi";
  }
  return null;
}

export type PasswordCheck = { id: "length" | "variety" | "personal"; label: string; ok: boolean };

export function passwordChecks(password: string, who: Who = {}): PasswordCheck[] {
  return [
    {
      id: "length",
      label: `Almeno ${PASSWORD_MIN} caratteri`,
      ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    },
    {
      id: "variety",
      label: `Almeno ${MIN_DISTINCT_CHARS} caratteri diversi`,
      ok: distinctChars(password) >= MIN_DISTINCT_CHARS,
    },
    {
      id: "personal",
      label: "Niente nome, email o «Orbitly»",
      ok: password.length > 0 && !personalPart(password, who),
    },
  ];
}

export const STRENGTH_LABELS = ["Non ancora", "Accettabile", "Buona", "Forte", "Ottima"] as const;

/** Pieces every guessing tool tries first: allowed, but the meter won't call them strong. */
export const hasCommonPattern = (password: string) =>
  /password|passw0rd|qwerty|asdfg|zxcvb|12345|54321|abcde|(.)\1{3}/i.test(password);

/**
 * 0 while a rule fails, then 1 to 4 as the password gets longer and more varied. A guide for the
 * meter, not a promise: a long phrase beats a short jumble, and the meter says so.
 */
export function passwordStrength(password: string, who: Who = {}): 0 | 1 | 2 | 3 | 4 {
  if (!passwordChecks(password, who).every((c) => c.ok)) return 0;
  if (hasCommonPattern(password)) return 1;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((re) => re.test(password)).length;
  const score =
    1 +
    Number(password.length >= 12) +
    Number(password.length >= 16) +
    Number(password.length >= 20) +
    Number(kinds >= 3);
  return Math.min(score, 4) as 1 | 2 | 3 | 4;
}
