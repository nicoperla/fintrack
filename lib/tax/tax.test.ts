import { describe, expect, it } from "vitest";
import { summarizeDeductions } from "@/lib/finance/deductions";
import {
  childrenDeduction,
  employeeDeduction,
  extraEmployeeDeduction,
  grossTax,
  marginalRate,
  parentsDeduction,
  pensionDeduction,
  rulesFor,
  spouseDeduction,
} from "./rules";
import {
  correctionPaths,
  defaultTaxYear,
  describeTiming,
  keepUntil,
  refundTiming,
  sendDeadlines,
  stageOf,
} from "./calendar";
import { EMPTY_SITUATION, assess, readSituation, type Situation } from "./situation";
import { docProgress, documentsFor, readDocStates } from "./documents";
import { digestNote, nextStep } from "./next-step";
import { crossingNote, distinctPayers, taxAlerts } from "./alerts";

const r2025 = rulesFor(2025);
const r2026 = rulesFor(2026);
const answered = (patch: Partial<Situation> = {}): Situation => ({
  ...EMPTY_SITUATION,
  work: "employee",
  agent: true,
  home: "owner",
  answeredAt: "2026-10-18T10:00:00.000Z",
  ...patch,
});

describe("year rules", () => {
  it("has the 2026 second bracket at 33%, 35% before", () => {
    expect(grossTax(30_000, r2025)).toBe(7140); // 6.440 + 2.000 × 35%
    expect(grossTax(30_000, r2026)).toBe(7100); // 6.440 + 2.000 × 33%
    expect(marginalRate(30_000, r2026)).toBe(0.33);
    expect(marginalRate(20_000, r2026)).toBe(0.23);
    expect(marginalRate(60_000, r2026)).toBe(0.43);
  });

  it("works out the employment deduction like table 6", () => {
    expect(employeeDeduction(12_000)).toBe(1955);
    expect(employeeDeduction(12_000, 73)).toBe(690); // never below 690 € up to 15.000 €
    expect(employeeDeduction(12_000, 73, true)).toBe(1380); // 1.380 € on a fixed-term job
    expect(employeeDeduction(20_000)).toBe(2642.33); // 1.910 + 1.190 × 0,6154
    expect(employeeDeduction(30_000)).toBe(1801.38); // 1.910 × 0,9091 + 65
    expect(employeeDeduction(60_000)).toBe(0);
  });

  it("works out pensions, the wedge cut and the family deductions", () => {
    expect(pensionDeduction(8_000, 30)).toBe(713);
    expect(extraEmployeeDeduction(25_000)).toBe(1000);
    expect(extraEmployeeDeduction(36_000)).toBe(500);
    expect(extraEmployeeDeduction(18_000)).toBe(0);
    expect(spouseDeduction(10_000)).toBe(726.66); // 800 − 110 × 0,6667
    expect(spouseDeduction(30_000)).toBe(710);
    expect(childrenDeduction(40_000, 1, 100)).toBe(549.95); // 950 × 0,5789 (55.000 / 95.000)
    expect(childrenDeduction(40_000, 1)).toBe(274.98); // half each
    expect(parentsDeduction(40_000, 1)).toBe(375);
  });

  it("moves the last known rules forward for a year not checked yet", () => {
    const later = rulesFor(2028);
    expect(later.model).toBe("730/2029");
    expect(later.provisional).toBe(true);
    expect(later.calendar.deadline).toBe("2029-09-30");
    expect(later.irpef).toEqual(r2026.irpef);
  });
});

describe("the 730 calendar", () => {
  it("shows last year's 730 until September, then the new one", () => {
    expect(defaultTaxYear({ year: 2026, month: 8 })).toBe(2025);
    expect(defaultTaxYear({ year: 2026, month: 9 })).toBe(2026);
  });

  it("follows the stages of the year", () => {
    expect(stageOf(r2026, "2026-10-18", null)).toBe("year");
    expect(stageOf(r2026, "2027-02-01", null)).toBe("prepare");
    expect(stageOf(r2026, "2027-05-02", null)).toBe("precompiled");
    expect(stageOf(r2026, "2027-06-01", null)).toBe("send");
    expect(stageOf(r2026, "2027-06-01", "2027-05-20")).toBe("after");
    expect(stageOf(r2026, "2027-10-01", null)).toBe("after");
  });

  it("says when the refund arrives from the day it's sent", () => {
    expect(refundTiming(r2025, "2026-05-20", "employee")).toMatchObject({ from: 7, to: 7 });
    expect(refundTiming(r2025, "2026-06-10", "employee")).toMatchObject({ from: 7, to: 8 });
    expect(refundTiming(r2025, "2026-05-20", "pensioner")).toMatchObject({ from: 8, to: 8 });
    expect(refundTiming(r2025, "2026-09-15", "employee")).toMatchObject({ from: 11 });
    expect(refundTiming(r2025, "2026-05-20", "agency")).toEqual({
      kind: "agency",
      by: "2027-03-31",
    });
    expect(describeTiming(refundTiming(r2025, "2026-05-20", "employee"))).toBe(
      "nella busta paga di luglio 2026",
    );
    expect(sendDeadlines(r2025, "2026-06-01", "employee").map((d) => d.sentBy)).toEqual([
      "2026-06-20",
      "2026-07-15",
      "2026-08-31",
      "2026-09-30",
    ]);
  });

  it("offers only the corrections still possible", () => {
    const kinds = (today: string, channel: "SELF" | "CAF") =>
      correctionPaths(r2025, today, channel).map((c) => c.kind);
    expect(kinds("2026-06-10", "SELF")).toEqual(["annul", "integrative", "redditi"]);
    expect(kinds("2026-06-10", "CAF")).toEqual(["integrative", "redditi"]);
    expect(kinds("2026-11-01", "SELF")).toEqual(["redditi"]);
  });

  it("keeps the papers until the fifth year after filing", () => {
    expect(keepUntil(2025)).toBe("2031-12-31");
  });
});

describe("Chi sei and the traffic light", () => {
  it("is green with one job and nothing else", () => {
    const a = assess(answered(), 0)!;
    expect(a.light).toBe("green");
    expect(a.obligation.state).toBe("no");
    expect(a.noAgent).toBe(false);
  });

  it("says filing pays off when there are deductions", () => {
    expect(assess(answered(), 120)!.obligation.text).toContain("circa 120 €");
  });

  it("turns yellow for rent, more employers or family changes", () => {
    expect(assess(answered({ home: "rent" }), 0)!.light).toBe("yellow");
    const more = assess(answered({ moreEmployers: true }), 0)!;
    expect(more.light).toBe("yellow");
    expect(more.obligation.state).toBe("maybe");
  });

  it("turns red for foreign accounts, crypto, separations and inheritances", () => {
    const crypto = assess(answered({ otherIncome: ["crypto"] }), 0)!;
    expect(crypto.light).toBe("red");
    expect(crypto.obligation.state).toBe("yes");
    expect(assess(answered({ events: ["death"] }), 0)!.light).toBe("red");
  });

  it("sends whoever has a partita IVA to the modello Redditi", () => {
    const a = assess(answered({ otherIncome: ["vat"] }), 0)!;
    expect(a.vat).toBe(true);
    expect(a.title).toContain("modello Redditi");
  });

  it("knows the Agenzia pays when nobody pays a salary in July", () => {
    expect(assess(answered({ work: "none", agent: false }), 0)!.noAgent).toBe(true);
  });

  it("isn't there before the answers, and drops what it doesn't know", () => {
    expect(assess(EMPTY_SITUATION, 0)).toBeNull();
    const s = readSituation({ work: "astronaut", children: 99, otherIncome: ["vat", "x"] });
    expect(s.work).toBeNull();
    expect(s.children).toBe(10);
    expect(s.otherIncome).toEqual(["vat"]);
  });
});

describe("documents", () => {
  it("asks for every CU with more employers and the IBAN without an employer", () => {
    const docs = documentsFor({
      situation: answered({ moreEmployers: true, work: "none", agent: false }),
      seen: [],
      rent: false,
      homeBonuses: 0,
      year: 2026,
    });
    expect(docs.find((d) => d.key === "cu")?.label).toBe("Tutte le Certificazioni Uniche 2027");
    expect(docs.some((d) => d.key === "iban")).toBe(true);
    expect(docs.some((d) => d.key === "agent")).toBe(false);
  });

  it("adds rent, mortgage, family and expenses only when they apply", () => {
    const docs = documentsFor({
      situation: answered({ home: "mortgage", children: 1 }),
      seen: ["sanitarie", "veterinarie"],
      rent: true,
      homeBonuses: 1,
      year: 2026,
    });
    const keys = docs.map((d) => d.key);
    for (const key of [
      "mortgage-interest",
      "rent-contract",
      "children-income",
      "renovation",
      "expense-sanitarie",
      "expense-veterinarie",
    ]) {
      expect(keys, key).toContain(key);
    }
    expect(docs.find((d) => d.key === "expense-sanitarie")?.label).toContain("Tessera Sanitaria");
  });

  it("counts progress without the CAF-only papers when filing alone", () => {
    const docs = documentsFor({
      situation: answered(),
      seen: [],
      rent: false,
      homeBonuses: 0,
      year: 2026,
    });
    const states = readDocStates({ cu: "have", agent: "skip", junk: "maybe", "BAD KEY": "have" });
    expect(states).toEqual({ cu: "have", agent: "skip" });
    expect(docProgress(docs, states, false)).toEqual({ done: 1, total: 1 });
    expect(docProgress(docs, states, true)).toEqual({ done: 1, total: 3 });
  });
});

describe("the next step", () => {
  const base = {
    rules: r2026,
    docs: { done: 0, total: 3 },
    toCheck: 0,
    hasCu: false,
    decision: null,
    channel: null,
    sentAt: null,
    result: null,
    refundReceivedAt: null,
    payer: "employee" as const,
  };
  const a = assess(answered(), 0);

  it("starts from the six questions", () => {
    expect(nextStep({ ...base, stage: "year", today: "2026-10-18", assessment: null }).target).toBe(
      "situation",
    );
  });

  it("asks for the CU in the spring, then the documents", () => {
    const step = nextStep({ ...base, stage: "prepare", today: "2027-02-01", assessment: a });
    expect(step).toMatchObject({ target: "estimate", due: "2027-03-16" });
    const docs = nextStep({
      ...base,
      hasCu: true,
      stage: "prepare",
      today: "2027-03-20",
      assessment: a,
    });
    expect(docs.target).toBe("documents");
  });

  it("points to the CAF, or to the date that brings the refund in July", () => {
    const caf = nextStep({
      ...base,
      decision: "CAF",
      stage: "send",
      today: "2027-05-20",
      assessment: a,
    });
    expect(caf).toMatchObject({ target: "send", due: "2027-05-31" });
    const self = nextStep({
      ...base,
      decision: "ACCEPT",
      stage: "send",
      today: "2027-06-05",
      assessment: a,
    });
    expect(self.title).toBe("Invia il 730 entro il 20 giugno");
  });

  it("follows the money after sending", () => {
    const step = nextStep({
      ...base,
      stage: "after",
      today: "2027-06-10",
      assessment: a,
      sentAt: "2027-05-20",
      result: 280,
    });
    expect(step.title).toContain("Rimborso di");
    expect(step.text).toContain("luglio 2027");
  });

  it("goes in the weekly summary only when the date is close", () => {
    const step = nextStep({ ...base, stage: "prepare", today: "2027-03-01", assessment: a });
    expect(digestNote(step, "prepare", "2027-03-01")).not.toBeNull();
    expect(digestNote(step, "prepare", "2027-01-10")).toBeNull();
  });
});

describe("alerts", () => {
  it("tells different employers apart, ignoring how the salary is written", () => {
    expect(
      distinctPayers([
        { description: "Stipendio ACME S.r.l. gennaio", amount: 1500 },
        { description: "Accredito stipendio Acme srl", amount: 1500 },
        { description: "Stipendio Beta Spa", amount: 1200 },
        { description: "Rimborso spese", amount: 50 },
      ]),
    ).toEqual(["acme", "beta"]);
  });

  it("warns about two salaries and money lost to cash", () => {
    const summary = summarizeDeductions(
      [
        {
          id: "1",
          date: "2026-03-01",
          description: "Dentista",
          amount: 200,
          account: "Contanti",
          accountType: "CASH",
          memberId: "u",
          category: "Visite mediche",
          parent: "Salute",
          override: null,
        },
      ],
      0,
    );
    const keys = taxAlerts({
      year: 2026,
      today: "2026-12-05",
      summary,
      situation: answered(),
      payers: ["acme", "beta"],
      children: 0,
    }).map((a) => a.key);
    expect(keys).toEqual(expect.arrayContaining(["two-employers", "cash", "year-end"]));
  });

  it("speaks up when an expense crosses the franchigia or the limit", () => {
    expect(crossingNote("sanitarie", 100, 50)).toContain("superata la franchigia");
    expect(crossingNote("sanitarie", 200, 50)).toBeNull();
    expect(crossingNote("sport", 150, 100, 1)).toContain("raggiunto il tetto");
  });
});
