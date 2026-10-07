import { describe, expect, it } from "vitest";
import { monthsText, ofDate, onDate, onDay, toDate, untilPayday } from "./format";

describe("Italian dates", () => {
  it("elides before 1, 8 and 11", () => {
    expect(onDate("2026-12-01")).toBe("l'1 dicembre");
    expect(onDate("2026-12-16")).toBe("il 16 dicembre");
    expect(toDate("2026-11-08")).toBe("all'8 novembre");
    expect(toDate("2026-10-27")).toBe("al 27 ottobre");
    expect(ofDate("2026-12-11")).toBe("dell'11 dicembre");
    expect(onDay(1)).toBe("l'1");
    expect(onDay(30)).toBe("il 30");
  });

  it("lists months in order", () => {
    expect(monthsText([12, 6])).toBe("giugno e dicembre");
    expect(monthsText([11, 5, 8])).toBe("maggio, agosto e novembre");
    expect(monthsText([3])).toBe("marzo");
  });

  it("says until when the money has to last", () => {
    expect(untilPayday({ date: "2026-10-27", source: "salary", name: "Stipendio" })).toBe(
      "fino al 27 ottobre, quando arriva lo stipendio",
    );
    expect(untilPayday({ date: "2026-11-01", source: "manual", name: null })).toBe(
      "fino all'1 novembre, giorno dello stipendio",
    );
    expect(untilPayday({ date: "2026-11-01", source: "month-end", name: null })).toBe(
      "fino a fine mese",
    );
  });
});
