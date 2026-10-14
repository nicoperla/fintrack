import { describe, expect, it } from "vitest";
import { passwordChecks, passwordStrength, personalPart } from "./password-rules";

const failing = (password: string, who = {}) =>
  passwordChecks(password, who)
    .filter((c) => !c.ok)
    .map((c) => c.id);

describe("passwordChecks", () => {
  it("ticks off each rule on its own", () => {
    expect(failing("")).toEqual(["length", "variety", "personal"]);
    expect(failing("aaaaaaaaaaaa")).toEqual(["variety"]);
    expect(failing("abc12")).toEqual(["length"]);
    expect(failing("treno lento sul lago")).toEqual([]);
  });

  it("refuses the name, the email and the app's name", () => {
    expect(failing("anna.rossi2026", { email: "anna.rossi@example.com" })).toEqual(["personal"]);
    expect(failing("Giuseppe-1990", { name: "Giuseppe Verdi" })).toEqual(["personal"]);
    expect(personalPart("Orbitly2026!")).toBe("email");
    expect(personalPart("FinTrack2026!")).toBe("email");
    // Short names would forbid too much: "Ugo" may appear in a password.
    expect(failing("sugo di pomodoro", { name: "Ugo" })).toEqual([]);
  });

  it("refuses passwords bcrypt would cut", () => {
    expect(failing("abcdefghij".repeat(8))).toEqual(["length"]);
  });
});

describe("passwordStrength", () => {
  it("is 0 while a rule fails", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("aaaaaaaaaaaa")).toBe(0);
  });

  it("rewards length more than symbols", () => {
    expect(passwordStrength("trenolento")).toBe(1);
    expect(passwordStrength("Treno-lent0")).toBe(2);
    expect(passwordStrength("treno lento sul")).toBe(2);
    expect(passwordStrength("treno lento sul lago")).toBe(4);
  });

  it("never calls the usual sequences strong, however long", () => {
    expect(passwordStrength("password1234")).toBe(1);
    expect(passwordStrength("Qwerty-tastiera-2026")).toBe(1);
    expect(passwordStrength("treno 12345 sul lago")).toBe(1);
    expect(passwordStrength("ciaooooo mondo")).toBe(1);
  });
});
