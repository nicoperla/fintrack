/*
 * FinTrack service worker: makes the app installable and usable offline for consultation.
 *
 * - Pages (navigations): network first, so data is always fresh online; the last good copy of
 *   each visited page is kept and shown offline, with /offline.html for pages never visited.
 * - Build assets (/_next/static, content-hashed): cache first.
 * - Everything else (API, server actions, RSC payloads): straight to the network. When an RSC
 *   request fails offline, Next falls back to a full navigation, which the cache can serve.
 *
 * Writes made offline are not queued here: the app keeps them in an outbox and replays them
 * when the connection comes back (see lib/offline/outbox.ts).
 */

const VERSION = "v2";
const STATIC_CACHE = `fintrack-static-${VERSION}`;
const PAGES_CACHE = `fintrack-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/192.png"];

// Never cache the auth pages: they'd show a stale login state.
const NO_CACHE_PAGES = ["/login", "/register", "/forgot-password", "/reset-password", "/invite"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("fintrack-") && !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Sent by the app on sign-out: cached pages contain the user's finances.
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES_CACHE));
});

async function networkFirstPage(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    const cacheable =
      response.ok &&
      !response.redirected &&
      response.type === "basic" &&
      !NO_CACHE_PAGES.some((path) => url.pathname.startsWith(path));
    if (cacheable) {
      const cache = await caches.open(PAGES_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(PAGES_CACHE);
    return (
      (await cache.match(request)) ||
      (await cache.match(request, { ignoreSearch: true })) ||
      (await caches.match(OFFLINE_URL))
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});
