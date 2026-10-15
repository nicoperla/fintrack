/*
 * Which paths need a session (after the pre-launch gate, see lib/gate.ts). Everything does except
 * the landing page ("/"), the auth and legal pages, the email links, the family file shared with
 * a trusted person (its token is the key), NextAuth's API, the cron jobs, the Stripe webhook,
 * static assets (landing/: the landing page media; icon: the browser tab's; email-assets/: the
 * pictures in the emails, fetched by mail clients) and the email preview of `next dev`, so new
 * pages are protected by default.
 */

const NO_SESSION =
  /^(?:login|register|forgot-password|reset-password|verify-email|privacy|terms|accesso|api\/accesso|api\/auth|api\/cron|api\/billing\/webhook|invite|fascicolo\/condiviso\/|patto\/arbitro\/|api\/digest\/unsubscribe|api\/dev\/|_next\/static|_next\/image|favicon\.ico|manifest\.webmanifest|robots\.txt|sw\.js|offline\.html|icon|icons\/|email-assets\/|landing\/|apple-icon|opengraph-image)/;

export const needsSession = (pathname: string) =>
  pathname.length > 1 && !NO_SESSION.test(pathname.slice(1));
