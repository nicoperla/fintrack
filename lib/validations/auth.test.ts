import { describe, expect, it } from "vitest";
import { registerSchema } from "./auth";

const base = { name: "Anna", email: "Anna@Example.com ", password: "unapassword" };

describe("registerSchema", () => {
  it("requires accepting the terms and the privacy policy", () => {
    const result = registerSchema.safeParse({ ...base, acceptTerms: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["acceptTerms"]);
  });

  it("accepts a complete sign-up and normalizes the email", () => {
    const result = registerSchema.parse({ ...base, acceptTerms: true });
    expect(result.email).toBe("anna@example.com");
  });
});
