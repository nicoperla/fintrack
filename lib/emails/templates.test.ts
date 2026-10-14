import { describe, expect, it } from "vitest";
import {
  inviteEmail,
  passwordResetEmail,
  securityEmail,
  supportTwoFactorResetEmail,
  verificationEmail,
} from "./templates";

const appUrl = "https://orbitly.example";
const where = {
  device: "Safari su iPhone",
  place: "Milano, IT",
  at: new Date("2026-10-09T08:30:00Z"),
};

describe("emails", () => {
  it("welcome the new member with their card and the link, in both versions", () => {
    const email = verificationEmail({
      appUrl,
      name: "Giulia Bianchi",
      email: "giulia@example.com",
      link: `${appUrl}/verify-email?token=abc`,
      since: new Date("2026-10-14T10:00:00Z"),
    });
    expect(email.subject).toBe("🪐 Giulia, sei quasi a bordo: conferma la tua email");
    expect(email.html).toContain(`href="${appUrl}/verify-email?token=abc"`);
    expect(email.html).toContain("Tessera Orbitly");
    expect(email.html).toContain("Da ottobre 2026");
    expect(email.text).toContain(`${appUrl}/verify-email?token=abc`);
    expect(email.text).toMatch(/^Ciao Giulia,/);
    expect(email.tag).toBe("verify-email");
  });

  it("take the pictures from the app, at absolute addresses", () => {
    const { html } = passwordResetEmail({ appUrl, link: `${appUrl}/reset-password?token=x` });
    expect(html).toContain(`src="${appUrl}/email-assets/hero-violet.png?v=1"`);
    expect(html).toContain(`src="${appUrl}/email-assets/logo.png?v=1"`);
    expect(html).toMatch(/^<!doctype html>/);
  });

  it("escape names and space names that come from users", () => {
    const evil = "<img src=x onerror=alert(1)>";
    const invite = inviteEmail({ appUrl, inviter: evil, spaceName: `Casa ${evil}`, link: appUrl });
    const welcome = verificationEmail({ appUrl, name: evil, email: "a@b.it", link: appUrl });
    for (const html of [invite.html, welcome.html]) {
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    }
  });

  it("show where and when a sign-in happened, and the way out", () => {
    const email = securityEmail({ kind: "new-device", where }, { appUrl, name: "Anna Rossi" });
    expect(email.subject).toBe("Nuovo accesso al tuo account Orbitly");
    expect(email.html).toContain("Safari su iPhone");
    expect(email.html).toContain("Milano, IT");
    expect(email.html).toContain("9 ottobre 2026");
    expect(email.html).toContain(`href="${appUrl}/forgot-password"`);
    expect(email.html).toContain("hero-amber.png");
    expect(email.text).toContain(
      "un dispositivo che non avevamo mai visto: Safari su iPhone, da Milano, IT, il 9 ottobre 2026 alle ore 10:30.",
    );
    expect(email.tag).toBe("security-new-device");
  });

  it("colour each security notice by how worrying it is", () => {
    const hero = (html: string) => html.match(/hero-(\w+)\.png/)?.[1];
    expect(hero(securityEmail({ kind: "wrong-code", where }, { appUrl }).html)).toBe("rose");
    expect(hero(securityEmail({ kind: "two-factor-on" }, { appUrl }).html)).toBe("emerald");
    expect(hero(securityEmail({ kind: "two-factor-off" }, { appUrl }).html)).toBe("amber");
  });

  it("send the support's 2FA reset to the security settings", () => {
    const email = supportTwoFactorResetEmail({ appUrl, name: "Anna" });
    expect(email.html).toContain(`href="${appUrl}/settings#sicurezza"`);
    expect(email.text).toContain("rispondi subito a questa email");
  });
});
