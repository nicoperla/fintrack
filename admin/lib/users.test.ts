import { describe, expect, it } from "vitest";
import { filtersHref, readFilters, subscriptionLabel, toCsv, usersWhere } from "./users";

describe("users list filters", () => {
  it("reads only known values from the URL", () => {
    const f = readFilters({
      q: "  anna ",
      plan: "PRO",
      status: "bogus",
      page: "-3",
      sort: "email",
    });
    expect(f).toMatchObject({ q: "anna", plan: "PRO", status: "", page: 1, sort: "email" });
  });

  it("builds the query for each filter", () => {
    const where = usersWhere(
      readFilters({ q: "anna", plan: "FREE", twofa: "yes", suspended: "no", status: "none" }),
    );
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { email: { contains: "anna", mode: "insensitive" } },
            { name: { contains: "anna", mode: "insensitive" } },
            { id: "anna" },
            { stripeCustomerId: "anna" },
          ],
        },
        { plan: "FREE" },
        { subscriptionStatus: null },
        { twoFactorEnabledAt: { not: null } },
        { suspendedAt: null },
      ],
    });
    expect(usersWhere(readFilters({}))).toEqual({});
  });

  it("keeps the filters in links, dropping defaults", () => {
    const f = readFilters({ q: "anna", plan: "PRO", page: "3" });
    expect(filtersHref(f, { page: 4 })).toBe("/utenti?q=anna&plan=PRO&page=4");
    expect(filtersHref(f, { plan: "" })).toBe("/utenti?q=anna");
    expect(filtersHref(readFilters({}), {}, "/utenti/export")).toBe("/utenti/export");
  });
});

describe("subscriptionLabel", () => {
  const user = (subscriptionStatus: string | null, plan = "PRO", planCancelsAtEnd = false) => ({
    plan,
    subscriptionStatus,
    planCancelsAtEnd,
  });
  it("names each state", () => {
    expect(subscriptionLabel(user("active")).text).toBe("Pro");
    expect(subscriptionLabel(user("active", "PRO", true)).text).toBe("Pro, disdetto");
    expect(subscriptionLabel(user("past_due")).tone).toBe("red");
    expect(subscriptionLabel(user("comp")).text).toBe("Pro omaggio");
    expect(subscriptionLabel(user(null, "FREE")).text).toBe("Free");
  });
});

describe("toCsv", () => {
  it("quotes cells and neutralises formulas for Excel", () => {
    expect(
      toCsv([
        ["a;b", 'say "hi"', null],
        ["=SUM(A1)", "+39 333", "@x"],
      ]),
    ).toBe('"a;b";"say ""hi""";""\r\n"\'=SUM(A1)";"\'+39 333";"\'@x"');
  });
});
