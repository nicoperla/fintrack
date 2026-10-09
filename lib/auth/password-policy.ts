import { createHash } from "crypto";

/*
 * Checks on a new password beyond the length: not the email, not "aaaaaaaaaa", and not one of
 * the passwords already leaked in data breaches, the first ones attackers try.
 */

/**
 * Have I Been Pwned, "k-anonymity" mode: only the first 5 characters of the SHA-1 leave the
 * server, the answer lists every leaked hash with that prefix and the match is done here.
 * Fails open: without an answer in time, the password is accepted.
 */
export async function isPwnedPassword(password: string, timeoutMs = 2500) {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      // Padding hides from an eavesdropper how many hashes came back.
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return false;
    for (const line of (await res.text()).split("\n")) {
      const [hash, count] = line.trim().split(":");
      if (hash === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Why this password isn't good enough, or null. The length is checked by the form schema. */
export async function passwordProblem(
  password: string,
  { email, name }: { email?: string | null; name?: string | null } = {},
) {
  const lower = password.toLowerCase();
  const local = email?.split("@")[0]?.toLowerCase();
  if ((local && local.length >= 4 && lower.includes(local)) || lower.includes("fintrack")) {
    return "Non usare la tua email o il nome dell'app nella password";
  }
  const first = name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (first && first.length >= 4 && lower.includes(first)) {
    return "Non usare il tuo nome nella password";
  }
  if (new Set(lower).size < 5) {
    return "Troppo prevedibile: usa più caratteri diversi";
  }
  if (await isPwnedPassword(password)) {
    return "Questa password è già comparsa in un furto di dati online: scegline un'altra";
  }
  return null;
}
