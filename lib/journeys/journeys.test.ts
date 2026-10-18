import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JOURNEYS, JOURNEY_KEYS, journeyByKey } from "./catalog";
import { docStatus, daysUntil, DOC_KINDS, DOC_KIND_INFO } from "./documents";
import { journeyProgress, upcomingSteps } from "./progress";

const root = path.resolve(__dirname, "../..");

describe("the journeys catalog", () => {
  it("has every journey once, with unique steps", () => {
    expect(JOURNEYS.map((j) => j.key)).toEqual([...JOURNEY_KEYS]);
    for (const j of JOURNEYS) {
      const keys = j.steps.map((s) => s.key);
      expect(new Set(keys).size, j.key).toBe(keys.length);
      for (const key of keys) expect(key).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it("links only to pages that exist in the app", () => {
    for (const step of JOURNEYS.flatMap((j) => j.steps)) {
      if (!step.app) continue;
      const page = path.join(root, "app/(dashboard)", step.app.href, "page.tsx");
      expect(existsSync(page), step.app.href).toBe(true);
    }
  });

  it("has the legal deadlines people get wrong", () => {
    const due = (key: string, step: string) =>
      journeyByKey(key)!.steps.find((s) => s.key === step)!.dueDays;
    expect(due("lavoro", "naspi")).toBe(68);
    expect(due("figlio", "nascita")).toBe(10);
    expect(due("figlio", "assegno")).toBe(120);
    expect(due("affitto", "residenza")).toBe(20);
    expect(due("lutto", "successione")).toBe(365);
  });
});

describe("journeyProgress", () => {
  const job = journeyByKey("lavoro")!;

  it("counts deadlines from the day of the event", () => {
    const p = journeyProgress(job, "2026-10-01", [], "2026-10-18");
    const naspi = p.steps.find((s) => s.key === "naspi")!;
    expect(naspi.due).toBe("2026-12-08"); // 68 days after the last day of work
    expect(naspi.days).toBe(51);
    expect(naspi.state).toBe("open");
    // The nearest deadline comes first: rethinking the spending, due 14 days after.
    expect(p.next?.key).toBe("spese");
    expect(p.late).toBe(1);
  });

  it("marks steps done, soon and late", () => {
    const p = journeyProgress(job, "2026-10-01", ["spese"], "2026-12-01");
    const state = (key: string) => p.steps.find((s) => s.key === key)!.state;
    expect(state("spese")).toBe("done");
    expect(state("naspi")).toBe("soon");
    expect(state("tfr")).toBe("late");
    expect(p.done).toBe(1);
  });

  it("lists for the summary only what's due within a week", () => {
    const steps = upcomingSteps(job, "2026-10-01", [], "2026-12-03");
    expect(steps.map((s) => s.key)).toContain("naspi");
    expect(upcomingSteps(job, "2026-10-01", ["naspi", "tfr", "spese"], "2026-12-03")).toEqual([]);
  });
});

describe("document expiry", () => {
  it("says when it's time to renew, with each document's lead time", () => {
    expect(daysUntil("2026-10-18", "2026-11-17")).toBe(30);
    expect(docStatus("CIE", "2027-01-15", "2026-10-18")).toBe("renew"); // 89 days: queues are long
    expect(docStatus("TESSERA", "2027-01-15", "2026-10-18")).toBe("soon");
    expect(docStatus("PATENTE", "2026-10-01", "2026-10-18")).toBe("expired");
    expect(docStatus("PASSAPORTO", "2029-05-01", "2026-10-18")).toBe("ok");
  });

  it("knows how to renew every kind", () => {
    for (const kind of DOC_KINDS) expect(DOC_KIND_INFO[kind].renew.length).toBeGreaterThan(10);
  });
});
