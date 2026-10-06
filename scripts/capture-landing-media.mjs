/*
 * Screenshots and demo videos of the real app for the landing page (public/landing/).
 *
 *   npm run build && npx next start -p 3001        (in another terminal, with the demo seeded)
 *   node scripts/capture-landing-media.mjs
 *
 * Drives the local Chrome (no browser download) logged in as the demo account. Videos are
 * recorded with the DevTools screencast and encoded to H.264 MP4 inside Chrome (WebCodecs +
 * mp4-muxer), so they play everywhere, iPhone included. Re-run it whenever the UI changes.
 *
 * Env: CAPTURE_URL (default http://localhost:3001), CHROME_PATH, ONLY=shots|videos.
 */
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const BASE = process.env.CAPTURE_URL ?? "http://localhost:3001";
const OUT = "public/landing";
const CHROME =
  process.env.CHROME_PATH ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find((p) => existsSync(p));
// The demo account created by prisma/seed.ts.
const DEMO = { email: "demo@fintrack.app", password: "demo1234" };
const ONLY = process.env.ONLY;

const require = createRequire(import.meta.url);
// The browser build (a global `Mp4Muxer`), loaded into the encoding page.
const MUXER = require.resolve("mp4-muxer");

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** One login for the whole run: the app allows only a few attempts per email. */
let session = null;

async function newContext(browser, { viewport, scale, dark = true, reduceMotion = false }) {
  const context = await browser.newContext({
    storageState: session ?? undefined,
    viewport,
    deviceScaleFactor: scale,
    colorScheme: dark ? "dark" : "light",
    reducedMotion: reduceMotion ? "reduce" : "no-preference",
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    isMobile: viewport.width < 600,
    hasTouch: viewport.width < 600,
  });
  const page = await context.newPage();
  if (session) {
    await page.goto(`${BASE}/dashboard`);
  } else {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', DEMO.email);
    await page.fill('input[name="password"]', DEMO.password);
    await Promise.all([page.waitForURL("**/dashboard"), page.click('button[type="submit"]')]);
    session = await context.storageState();
  }
  await page.getByText("Soldi disponibili", { exact: true }).waitFor();
  return { context, page };
}

async function settle(page, ms = 900) {
  // Keep the virtual mouse off the page: hover states (chart tooltips) would end up in the shots.
  await page.mouse.move(1, 1);
  await page.waitForLoadState("networkidle").catch(() => {});
  await pause(ms);
}

async function shot(target, name, options = {}) {
  await target.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 82, ...options });
  console.log(`  foto ${name}.jpg`);
}

async function go(page, path, waitText) {
  await page.goto(`${BASE}${path}`);
  if (waitText) await page.getByText(waitText).first().waitFor();
  await settle(page);
}

async function screenshots(browser) {
  console.log("Foto desktop");
  {
    const { context, page } = await newContext(browser, {
      viewport: DESKTOP,
      scale: 1.5,
      reduceMotion: true,
    });
    await settle(page);
    await shot(page, "shot-dashboard");

    const forecast = page.locator('section[aria-labelledby="forecast-title"]');
    await forecast.scrollIntoViewIfNeeded();
    await settle(page, 500);
    await shot(forecast, "shot-forecast");

    await go(page, "/ritrovati", "Il tuo 730");
    await shot(page, "shot-ritrovati");

    await go(page, "/coach", "La tua salute finanziaria");
    await shot(page, "shot-coach");
    const afford = page.locator('section[aria-labelledby="afford-title"]');
    await afford.scrollIntoViewIfNeeded();
    await page
      .getByRole("textbox", { name: "Cosa vuoi comprare e quanto costa" })
      .fill("weekend a Roma 350");
    await settle(page, 700);
    await shot(afford, "shot-afford");

    await go(page, "/insights", "Insight del mese");
    await shot(page, "shot-insights");

    await go(page, "/split", "Chi ha pagato cosa");
    await shot(page, "shot-split");

    await go(page, "/investments", "Valore e versato nel tempo");
    await shot(page, "shot-investments");
    await context.close();
  }
  {
    const { context, page } = await newContext(browser, {
      viewport: DESKTOP,
      scale: 1.5,
      dark: false,
      reduceMotion: true,
    });
    await settle(page);
    await shot(page, "shot-dashboard-light");
    await context.close();
  }

  console.log("Foto mobile");
  {
    const { context, page } = await newContext(browser, {
      viewport: MOBILE,
      scale: 2,
      reduceMotion: true,
    });
    await settle(page);
    await shot(page, "mobile-dashboard");

    const quick = page.getByRole("textbox", { name: /Inserimento rapido/ });
    await quick.fill("sigarette 6,20");
    await settle(page, 600);
    await shot(page, "mobile-quick");
    await quick.fill("");

    await go(page, "/ritrovati", "Il tuo 730");
    await shot(page, "mobile-ritrovati");

    await go(page, "/coach", "La tua salute finanziaria");
    await shot(page, "mobile-coach");

    await go(page, "/stories", null);
    await page.keyboard.press("Space"); // pause the slides
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await settle(page, 900);
    await shot(page, "mobile-stories");
    await context.close();
  }
}

/** Records what `script` does on the page, as screencast frames with their timestamps. */
async function screencast(page, size, script) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: size.width,
    maxHeight: size.height,
    everyNthFrame: 1,
  });
  await pause(400);
  await script();
  await pause(600);
  await cdp.send("Page.stopScreencast");
  await cdp.detach();
  return frames;
}

/** Encodes the frames to an H.264 MP4 at a constant frame rate, inside Chrome. */
async function encode(browser, frames, size, name, { bitrate, holdEnd = 1.2, posterAt = 2 }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/offline.html`);
  await page.addScriptTag({ path: MUXER });
  await page.evaluate(() => (window.__frames = []));
  for (let i = 0; i < frames.length; i += 25) {
    await page.evaluate((batch) => window.__frames.push(...batch), frames.slice(i, i + 25));
  }

  const result = await page.evaluate(
    async ({ width, height, bitrate, holdEnd }) => {
      const fps = 30;
      const codecs = ["avc1.640028", "avc1.4d0028", "avc1.42E028"];
      let codec = null;
      for (const c of codecs) {
        const { supported } = await VideoEncoder.isConfigSupported({
          codec: c,
          width,
          height,
          bitrate,
        });
        if (supported) {
          codec = c;
          break;
        }
      }
      if (!codec) throw new Error("H.264 non disponibile in questo Chrome");

      const muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: { codec: "avc", width, height, frameRate: fps },
        fastStart: "in-memory",
      });
      let failure = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => (failure = e),
      });
      encoder.configure({
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
        latencyMode: "quality",
        avc: { format: "avc" },
      });

      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      const frames = window.__frames;
      const draw = async (b64) => {
        const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob();
        const bitmap = await createImageBitmap(blob);
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
      };

      const t0 = frames[0].t;
      const total = Math.ceil((frames[frames.length - 1].t - t0 + holdEnd) * fps);
      let source = 0;
      await draw(frames[0].data);
      for (let i = 0; i < total; i++) {
        const time = t0 + i / fps;
        let next = source;
        while (next + 1 < frames.length && frames[next + 1].t <= time) next++;
        if (next !== source) {
          source = next;
          await draw(frames[source].data);
        }
        const frame = new VideoFrame(canvas, {
          timestamp: Math.round((i * 1e6) / fps),
          duration: Math.round(1e6 / fps),
        });
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();
        if (encoder.encodeQueueSize > 20) {
          await new Promise((r) => encoder.addEventListener("dequeue", r, { once: true }));
        }
        if (failure) throw failure;
      }
      await encoder.flush();
      muxer.finalize();
      const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      return { dataUrl, codec, seconds: total / fps };
    },
    { width: size.width, height: size.height, bitrate, holdEnd },
  );
  await context.close();

  const mp4 = Buffer.from(result.dataUrl.split(",")[1], "base64");
  await writeFile(`${OUT}/${name}.mp4`, mp4);
  const t0 = frames[0].t;
  const poster = frames.reduce((best, f) => (f.t - t0 <= posterAt ? f : best), frames[0]);
  await writeFile(`${OUT}/${name}-poster.jpg`, Buffer.from(poster.data, "base64"));
  console.log(
    `  video ${name}.mp4: ${result.seconds.toFixed(1)} s, ${(mp4.length / 1e6).toFixed(1)} MB, ${result.codec}`,
  );
}

/** Types like a person: one key at a time. */
async function type(page, locator, text, delay = 85) {
  await locator.click();
  await locator.pressSequentially(text, { delay });
}

async function smoothScroll(page, y, wait = 1100) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
  await pause(wait);
}

async function videos(browser) {
  console.log("Video desktop");
  {
    const size = { width: 1280, height: 800 };
    const { context, page } = await newContext(browser, { viewport: size, scale: 1 });
    await page.goto(`${BASE}/dashboard`);
    await page.getByText("Soldi disponibili", { exact: true }).waitFor();
    await settle(page, 300);
    await page.goto(`${BASE}/dashboard`); // replay the count-up while recording
    // When each chapter starts, to update VIDEOS.desktop.chapters in components/landing/media.ts.
    const marks = [];
    const mark = (label) => marks.push({ label, t: Date.now() / 1000 });
    const frames = await screencast(page, size, async () => {
      await page.getByText("Soldi disponibili", { exact: true }).waitFor();
      await pause(1800);
      const quick = page.getByRole("textbox", { name: /Inserimento rapido/ });
      await type(page, quick, "sigarette 6,20");
      await pause(2200);
      await quick.fill("");
      await smoothScroll(page, 520, 2600);
      await page.locator('a[href="/ritrovati"]').first().click();
      await page.getByText("Il tuo 730").first().waitFor();
      mark("Soldi ritrovati");
      await pause(2600);
      await smoothScroll(page, 360, 2200);
      await page.goto(`${BASE}/coach`);
      await page.getByText("La tua salute finanziaria").waitFor();
      mark("Coach");
      await pause(2200);
      const afford = page.getByRole("textbox", { name: "Cosa vuoi comprare e quanto costa" });
      await afford.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy({ top: -90 }));
      await type(page, afford, "weekend a Roma 350", 70);
      await pause(3000);
      await page.goto(`${BASE}/stories`);
      mark("Storie");
      await pause(1600);
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press("ArrowRight");
        await pause(1700);
      }
    });
    await context.close();
    // Screencast timestamps are in seconds, like the marks: the video starts at the first frame.
    const t0 = frames[0].t;
    console.log(
      "  capitoli: " + marks.map((m) => `${m.label} ${(m.t - t0).toFixed(1)} s`).join(", "),
    );
    await encode(browser, frames, size, "video-desktop", { bitrate: 1_600_000, posterAt: 2.2 });
  }

  console.log("Video mobile");
  {
    const viewport = MOBILE;
    const size = { width: viewport.width * 2, height: viewport.height * 2 };
    const { context, page } = await newContext(browser, { viewport, scale: 2 });
    await page.goto(`${BASE}/dashboard`);
    const frames = await screencast(page, size, async () => {
      await page.getByText("Soldi disponibili", { exact: true }).waitFor();
      await pause(1600);
      const quick = page.getByRole("textbox", { name: /Inserimento rapido/ });
      await type(page, quick, "caffè 1,50", 110);
      await pause(1900);
      await quick.fill("");
      await page.locator("body").click({ position: { x: 5, y: 300 } });
      await smoothScroll(page, 760, 2200);
      await page.locator('a[href="/ritrovati"]').first().click();
      await page.getByText("Il tuo 730").first().waitFor();
      await pause(2400);
      await smoothScroll(page, 560, 2000);
      await page.goto(`${BASE}/stories`);
      await pause(1500);
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press("ArrowRight");
        await pause(1600);
      }
    });
    await context.close();
    await encode(browser, frames, size, "video-mobile", { bitrate: 1_400_000, posterAt: 1.6 });
  }
}

if (!CHROME) throw new Error("Chrome non trovato: imposta CHROME_PATH");
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--force-color-profile=srgb"],
});
try {
  if (ONLY !== "videos") await screenshots(browser);
  if (ONLY !== "shots") await videos(browser);
} finally {
  await browser.close();
}
