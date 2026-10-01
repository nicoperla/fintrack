import { describe, expect, it } from "vitest";
import { usesTestSender } from "./email";

describe("usesTestSender", () => {
  it("spots Resend's shared test address", () => {
    expect(usesTestSender("FinTrack <onboarding@resend.dev>")).toBe(true);
    expect(usesTestSender("onboarding@resend.dev")).toBe(true);
  });
  it("accepts a verified domain", () => {
    expect(usesTestSender("FinTrack <ciao@fintrack.it>")).toBe(false);
  });
});
