import { describe, expect, it } from "vitest";
import { rentProfileSchema, welfareSchema } from "./rights";

const schema = rentProfileSchema(2026);

describe("rentProfileSchema", () => {
  it("reads the answers", () => {
    expect(
      schema.parse({
        incomeBand: "fino-15k",
        birthYear: "1999",
        contract: "concordato",
        since: "2024",
        transferred: true,
      }),
    ).toEqual({
      incomeBand: "fino-15k",
      birthYear: 1999,
      contract: "concordato",
      since: 2024,
      transferred: true,
    });
  });

  it("turns what's left empty into null", () => {
    expect(schema.parse({ incomeBand: "", birthYear: "", contract: "", since: "" })).toEqual({
      incomeBand: null,
      birthYear: null,
      contract: null,
      since: null,
      transferred: false,
    });
  });

  it("rejects impossible years and unknown choices", () => {
    const issues = (input: object) =>
      schema
        .safeParse({ incomeBand: "", contract: "", ...input })
        .error?.issues.map((i) => i.path[0]);
    expect(issues({ birthYear: "2030" })).toEqual(["birthYear"]);
    expect(issues({ birthYear: "novanta" })).toEqual(["birthYear"]);
    expect(issues({ since: "1950" })).toEqual(["since"]);
    expect(issues({ incomeBand: "tanto" })).toEqual(["incomeBand"]);
    expect(issues({ contract: "comodato" })).toEqual(["contract"]);
  });
});

describe("welfareSchema", () => {
  it("reads amounts and the expiry date", () => {
    expect(welfareSchema.parse({ balance: "350,50", expiresOn: "2026-12-31", fringe: "" })).toEqual(
      { balance: 350.5, expiresOn: "2026-12-31", fringe: null },
    );
  });

  it("rejects a wrong amount or date", () => {
    expect(welfareSchema.safeParse({ balance: "tanti" }).success).toBe(false);
    expect(welfareSchema.safeParse({ expiresOn: "31/12/2026" }).success).toBe(false);
  });
});
