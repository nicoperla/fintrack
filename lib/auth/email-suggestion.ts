/*
 * "Did you mean …@gmail.com?" at sign-up: a mistyped domain means the confirmation email never
 * arrives and the account can't be recovered. Only a hint: the user can keep what they wrote.
 */

/** The mailboxes most used in Italy, most common first: on a tie the earlier one wins. */
const DOMAINS = [
  "gmail.com",
  "libero.it",
  "hotmail.it",
  "hotmail.com",
  "outlook.it",
  "outlook.com",
  "yahoo.it",
  "yahoo.com",
  "icloud.com",
  "live.it",
  "live.com",
  "alice.it",
  "virgilio.it",
  "tiscali.it",
  "fastwebnet.it",
  "tim.it",
  "tin.it",
  "inwind.it",
  "me.com",
  "msn.com",
  "proton.me",
  "protonmail.com",
];

/** Edit distance where swapping two neighbouring letters counts as one typo. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** The corrected address when the domain looks like a typo of a common one, else null. */
export function suggestEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return null;
  const domain = value.slice(at + 1);
  // Still being typed ("gmail." or "gmail.c"): wait for the ending.
  if (DOMAINS.includes(domain) || /\.[^.]?$/.test(domain)) return null;
  const local = value.slice(0, at);

  // The right name with the wrong ending (gmail.it): only where the provider has a single one.
  const parts = domain.split(".");
  const sameName = DOMAINS.filter((d) => d.split(".")[0] === parts[0]);
  if (parts.length === 2 && sameName.length === 1) return `${local}@${sameName[0]}`;

  // Short domains are close to many others: only one typo away counts there.
  const allowed = domain.length <= 6 ? 1 : 2;
  let best: string | null = null;
  let bestDistance = allowed + 1;
  for (const candidate of DOMAINS) {
    const d = distance(domain, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  if (best) return `${local}@${best}`;

  // Any other domain: only the ending, when it's clearly .com or .it gone wrong.
  const fixed = domain
    .replace(/\.(con|cmo|ocm|comm|vom|xom)$/, ".com")
    .replace(/\.(itt|ti)$/, ".it");
  return fixed === domain ? null : `${local}@${fixed}`;
}
