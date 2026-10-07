import { describe, expect, it } from "vitest";
import { bigExpenseSchema, trueSalarySettingsSchema } from "./true-salary";

const imu = { preset: "imu", name: "IMU", amount: "412", months: [12, 6, 6], day: "16" };

describe("bigExpenseSchema", () => {
  it("accepts a big expense, with its months in order and once each", () => {
    expect(bigExpenseSchema.parse(imu)).toEqual({
      preset: "imu",
      name: "IMU",
      amount: "412.00",
      months: [6, 12],
      day: 16,
    });
  });

  it("reads Italian amounts and accepts one of the user's own", () => {
    const parsed = bigExpenseSchema.parse({
      ...imu,
      preset: "",
      name: "  Abbonamento annuale ai mezzi  ",
      amount: "1.234,50",
    });
    expect(parsed).toMatchObject({
      preset: null,
      name: "Abbonamento annuale ai mezzi",
      amount: "1234.50",
    });
  });

  it("rejects what it can't plan", () => {
    const issues = (input: object) =>
      bigExpenseSchema.safeParse({ ...imu, ...input }).error?.issues.map((i) => i.path[0]);
    expect(issues({ months: [] })).toEqual(["months"]);
    expect(issues({ months: [13] })).toEqual(["months"]);
    expect(issues({ amount: "0" })).toEqual(["amount"]);
    expect(issues({ amount: "dodici" })).toEqual(["amount"]);
    expect(issues({ day: "32" })).toEqual(["day"]);
    expect(issues({ name: " " })).toEqual(["name"]);
    expect(issues({ preset: "nope" })).toEqual(["preset"]);
  });
});

describe("trueSalarySettingsSchema", () => {
  it("leaves out what isn't filled in", () => {
    expect(trueSalarySettingsSchema.parse({ payday: "", thirteenth: "", fourteenth: "0" })).toEqual(
      {
        payday: null,
        thirteenth: null,
        fourteenth: null,
        reserveAccountId: null,
      },
    );
  });

  it("reads the payday and the extra salaries", () => {
    expect(
      trueSalarySettingsSchema.parse({
        payday: "27",
        thirteenth: "1.650",
        fourteenth: "",
        reserveAccountId: "acc1",
      }),
    ).toEqual({ payday: 27, thirteenth: "1650.00", fourteenth: null, reserveAccountId: "acc1" });
  });

  it("rejects an impossible day or amount", () => {
    expect(trueSalarySettingsSchema.safeParse({ payday: "0" }).success).toBe(false);
    expect(trueSalarySettingsSchema.safeParse({ payday: "32" }).success).toBe(false);
    expect(trueSalarySettingsSchema.safeParse({ thirteenth: "-5" }).success).toBe(false);
  });
});
