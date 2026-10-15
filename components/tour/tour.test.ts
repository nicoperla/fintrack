import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { placeCard } from "./placement";
import { FEATURE_MAP, TOUR_STEPS } from "./tour-steps";

const root = path.resolve(import.meta.dirname, "../..");

/** Every .tsx file of the app, to look for the elements the tour lights up. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : sources(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}
const code = [...sources(path.join(root, "app")), ...sources(path.join(root, "components"))]
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
const nav = readFileSync(path.join(root, "components/layout/app-nav.tsx"), "utf8");

describe("guided tour", () => {
  it("lights up elements that exist in the app", () => {
    const names = TOUR_STEPS.flatMap((s) => s.targets ?? []);
    for (const name of names) {
      // Menu items are named from their address (tourName in app-nav.tsx).
      const found =
        code.includes(`data-tour="${name}"`) ||
        (name.startsWith("nav-") && nav.includes(`href: "/${name.slice(4)}"`));
      expect(found, name).toBe(true);
    }
  });

  it("opens only pages that exist from the map", () => {
    for (const feature of FEATURE_MAP.flatMap((g) => g.features)) {
      const page = path.join(root, "app/(dashboard)", feature.href, "page.tsx");
      expect(existsSync(page), feature.href).toBe(true);
    }
  });

  it("has a unique id for every step", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("placeCard", () => {
  const screen = { width: 1280, height: 720 };
  const card = { width: 392, height: 200 };

  it("puts the card below the element when it fits, with the arrow on it", () => {
    const spot = placeCard({ top: 100, left: 300, width: 200, height: 60 }, card, screen);
    expect(spot.top).toBe(100 + 60 + 14);
    expect(spot.arrow).toEqual({ side: "below", x: 300 + 100 - spot.left });
  });

  it("puts it above when there's no room below", () => {
    const spot = placeCard({ top: 600, left: 300, width: 200, height: 60 }, card, screen);
    expect(spot.top).toBe(600 - 14 - 200);
    expect(spot.arrow?.side).toBe("above");
  });

  it("keeps it on screen, against the far edge, when nothing fits", () => {
    const tall = placeCard({ top: 20, left: 0, width: 1280, height: 600 }, card, screen);
    expect(tall.top).toBe(720 - 200 - 12);
    expect(tall.arrow).toBeNull();
    const nearEdge = placeCard({ top: 100, left: 1250, width: 20, height: 20 }, card, screen);
    expect(nearEdge.left).toBe(1280 - 392 - 12);
  });

  it("centres the card when there's nothing to light up", () => {
    expect(placeCard(null, card, screen)).toEqual({ top: 260, left: 444, arrow: null });
  });
});
