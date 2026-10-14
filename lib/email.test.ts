import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail, usesTestSender } from "./email";

const message = { to: "anna@example.com", subject: "Ciao", text: "Ciao", html: "<p>Ciao</p>" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("usesTestSender", () => {
  it("spots Resend's shared test address", () => {
    expect(usesTestSender("Orbitly <onboarding@resend.dev>")).toBe(true);
    expect(usesTestSender("onboarding@resend.dev ")).toBe(true);
  });
  it("accepts a verified domain", () => {
    expect(usesTestSender("Orbitly <ciao@fintrack.it>")).toBe(false);
    expect(usesTestSender("Orbitly <ciao@resendxdev.it>")).toBe(false);
  });
});

describe("sendEmail without Resend", () => {
  it("prints the email locally", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("VERCEL_ENV", "");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(sendEmail(message)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });

  it("fails online, so nobody is told the email was sent", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("VERCEL_ENV", "production");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(sendEmail(message)).rejects.toThrow(/RESEND_API_KEY/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
