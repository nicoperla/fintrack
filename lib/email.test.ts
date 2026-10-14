import { afterEach, describe, expect, it, vi } from "vitest";
import { resendPayload, sendEmail, usesTestSender } from "./email";

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

describe("resendPayload", () => {
  it("sends replies to a real mailbox, tags the kind and keeps Gmail from threading", () => {
    vi.stubEnv("EMAIL_REPLY_TO", "ciao@orbitly.example");
    const payload = resendPayload("Orbitly <noreply@orbitly.example>", {
      ...message,
      tag: "security-new-device",
      headers: { "List-Unsubscribe": "<https://orbitly.example/u>" },
    });
    expect(payload).toMatchObject({
      from: "Orbitly <noreply@orbitly.example>",
      to: "anna@example.com",
      reply_to: "ciao@orbitly.example",
      tags: [{ name: "type", value: "security-new-device" }],
      headers: { "List-Unsubscribe": "<https://orbitly.example/u>" },
    });
    expect(payload.headers["X-Entity-Ref-ID"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload).not.toHaveProperty("tag");
  });

  it("leaves the reply address out when none is set", () => {
    vi.stubEnv("EMAIL_REPLY_TO", "");
    vi.stubEnv("LEGAL_EMAIL", "");
    expect(resendPayload("a@b.it", message)).not.toHaveProperty("reply_to");
  });
});
