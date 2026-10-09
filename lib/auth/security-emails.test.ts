import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyNewDevice, notifyRecoveryCodeUsed, notifyWrongCode } from "./security-emails";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://fintrack.example" }));

const anna = { email: "anna@example.com", name: "Anna Rossi" };
const at = new Date("2026-10-09T08:30:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue(undefined);
});

describe("security emails", () => {
  it("say where and when, with the way out if it wasn't the owner", async () => {
    await notifyNewDevice(anna, { device: "Safari su iPhone", place: "Milano, IT", at });
    const email = sendEmail.mock.calls[0][0];
    expect(email.to).toBe("anna@example.com");
    expect(email.subject).toBe("Nuovo accesso al tuo account FinTrack");
    expect(email.text).toContain("Ciao Anna,");
    expect(email.text).toContain(
      "Safari su iPhone, da Milano, IT, il 9 ottobre 2026 alle ore 10:30",
    );
    expect(email.text).toContain("https://fintrack.example/forgot-password");
    expect(email.html).toContain('href="https://fintrack.example/settings#sicurezza"');
  });

  it("escape what came from the request", async () => {
    await notifyWrongCode(anna, { device: "<img src=x onerror=alert(1)>", place: null, at });
    const { html } = sendEmail.mock.calls[0][0];
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("count the recovery codes left", async () => {
    await notifyRecoveryCodeUsed(anna, 1, { device: "Chrome su Windows", place: null, at });
    expect(sendEmail.mock.calls[0][0].text).toContain("Ti resta 1 codice.");
    await notifyRecoveryCodeUsed(anna, 0, { device: "Chrome su Windows", place: null, at });
    expect(sendEmail.mock.calls[1][0].text).toContain("Non ti restano codici di recupero");
  });

  it("never fail the action they describe", async () => {
    sendEmail.mockRejectedValue(new Error("Resend down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      notifyNewDevice(anna, { device: "Chrome su Windows", place: null, at }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
