const DEFAULT_REDIRECT = "/dashboard";

// Keeps only path + query so a crafted ?callbackUrl= can never send the user to another site.
export function safeCallbackUrl(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return DEFAULT_REDIRECT;
  try {
    const url = new URL(raw, "http://localhost");
    const path = url.pathname.replace(/^\/+/, "/");
    if (path === "/login" || path === "/register") return DEFAULT_REDIRECT;
    return path + url.search;
  } catch {
    return DEFAULT_REDIRECT;
  }
}
