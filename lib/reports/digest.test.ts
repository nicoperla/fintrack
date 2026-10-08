import { describe, expect, it } from "vitest";
import {
  buildWeeklyDigest,
  escapeHtml,
  spendingTrend,
  weekRangeLabel,
  type DigestInput,
} from "./digest";

const base: DigestInput = {
  name: "Mario Rossi",
  weekLabel: "dal 15 al 21 settembre",
  income: 0,
  expense: 240,
  previousExpense: 300,
  count: 12,
  topCategories: [
    { name: "Spesa", value: 120 },
    { name: "Ristoranti e bar", value: 80 },
  ],
  budgets: [],
  upcoming: [],
  claims: [],
  welfare: null,
  renewals: [],
  streak: { current: 5, longest: 9 },
  level: { level: 2, name: "Apprendista" },
  appUrl: "https://fintrack.example",
  unsubscribeUrl: "https://fintrack.example/api/digest/unsubscribe?u=1&t=abc",
};

// Intl uses non-breaking spaces in currency: normalize them for readable assertions.
const plain = (s: string) => s.replace(/[\s\u00a0\u202f]+/g, " ");

describe("weekRangeLabel", () => {
  it("formats a week within a month", () => {
    expect(weekRangeLabel("2026-09-14", "2026-09-20")).toBe("dal 14 al 20 settembre");
  });
  it("elides before 1, 8 and 11", () => {
    expect(weekRangeLabel("2026-06-01", "2026-06-07")).toBe("dall'1 al 7 giugno");
    expect(weekRangeLabel("2026-06-08", "2026-06-14")).toBe("dall'8 al 14 giugno");
  });
  it("names both months across a month boundary", () => {
    expect(weekRangeLabel("2026-09-28", "2026-10-04")).toBe("dal 28 settembre al 4 ottobre");
  });
});

describe("spendingTrend", () => {
  it("is null without a baseline", () => {
    expect(spendingTrend(100, 0)).toBeNull();
  });
  it("reports less spending as good", () => {
    expect(spendingTrend(240, 300)).toMatchObject({ pct: -20, good: true });
  });
  it("reports more spending as bad", () => {
    expect(spendingTrend(360, 300)).toMatchObject({ pct: 20, good: false });
  });
});

describe("buildWeeklyDigest", () => {
  it("summarizes the week in the subject", () => {
    const { subject } = buildWeeklyDigest(base);
    expect(plain(subject)).toBe("La tua settimana: 240,00 € spesi (-20%)");
  });

  it("has a gentle subject for an empty week", () => {
    const { subject, text } = buildWeeklyDigest({ ...base, count: 0, expense: 0 });
    expect(subject).toContain("tutto tranquillo");
    expect(text).toContain("Non hai registrato movimenti");
  });

  it("greets by first name and includes the key sections", () => {
    const { text } = buildWeeklyDigest({
      ...base,
      budgets: [{ name: "Svago", ratio: 1.2, status: "over", remaining: -30 }],
      upcoming: [{ name: "Netflix", amount: 12.99, date: "2026-09-24" }],
    });
    const t = plain(text);
    expect(t).toMatch(/^Ciao Mario,/);
    expect(t).toContain("Spesa: 120,00 €");
    expect(t).toContain("Svago: sforato di 30,00 €");
    expect(t).toContain("Netflix, circa 12,99 €");
    expect(t).toContain("Streak di 5 giorni (record: 9)");
    expect(t).toContain(base.unsubscribeUrl);
  });

  it("escapes user-provided text in the HTML", () => {
    const { html } = buildWeeklyDigest({
      ...base,
      topCategories: [{ name: "<script>alert(1)</script>", value: 10 }],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="https://fintrack.example/dashboard"');
  });

  it("lists the claims to follow, with a link to each", () => {
    const { text, html } = buildWeeklyDigest({
      ...base,
      claims: [
        {
          id: "c1",
          counterparty: "FitLife <Palestra>",
          kind: "Disdetta",
          step: "Ti hanno addebitato il servizio dopo la disdetta: chiedi il rimborso alla banca.",
          urgent: true,
        },
      ],
    });
    expect(text).toContain("Pratiche da seguire:");
    expect(text).toContain("- FitLife <Palestra> (disdetta): Ti hanno addebitato il servizio");
    expect(text).toContain("https://fintrack.example/ritrovati/pratiche/c1");
    expect(html).toContain("FitLife &lt;Palestra&gt;");
    expect(html).toContain('href="https://fintrack.example/ritrovati/pratiche/c1"');
  });

  it("reminds of company welfare about to expire", () => {
    const { text, html } = buildWeeklyDigest({
      ...base,
      welfare: { balance: 350, expiresOn: "2026-10-31", days: 24 },
    });
    expect(plain(text)).toContain(
      "Il credito welfare di 350,00 € scade il 31 ottobre: usalo prima che vada perso.",
    );
    expect(html).toContain("Da non perdere");
    expect(html).toContain('href="https://fintrack.example/ritrovati/radar"');
  });

  it("reminds of the RC auto and the fixed light price about to end", () => {
    const { text, html } = buildWeeklyDigest({
      ...base,
      renewals: [
        { kind: "ELECTRICITY", label: "Luce di casa", date: "2026-10-08", days: 1 },
        { kind: "CAR_INSURANCE", label: "Panda <2>", date: "2026-11-01", days: 25 },
      ],
    });
    expect(text).toContain("Da non perdere:");
    expect(text).toContain(
      "- Il prezzo bloccato di «Luce di casa» scade domani: confronta le offerte prima che cambi.",
    );
    expect(text).toContain(
      "- La RC auto di «Panda <2>» scade l'1 novembre: chiedi i preventivi prima di rinnovare.",
    );
    expect(text).toContain("https://fintrack.example/ritrovati/tariffometro");
    expect(html).toContain("«Panda &lt;2&gt;»");
    expect(html).toContain('href="https://fintrack.example/ritrovati/tariffometro"');
    expect(html).not.toContain("/ritrovati/radar");
  });

  it("leaves the claims out when there are none", () => {
    const { text, html } = buildWeeklyDigest(base);
    expect(text).not.toContain("Pratiche da seguire");
    expect(html).not.toContain("Pratiche da seguire");
  });

  it("celebrates a record streak", () => {
    const { text } = buildWeeklyDigest({ ...base, streak: { current: 10, longest: 10 } });
    expect(text).toContain("è il tuo record");
  });
});

describe("escapeHtml", () => {
  it("escapes quotes and angle brackets", () => {
    expect(escapeHtml(`"a" & <b> 'c'`)).toBe("&quot;a&quot; &amp; &lt;b&gt; &#39;c&#39;");
  });
});
