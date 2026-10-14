import { describe, expect, it } from "vitest";
import { suggestEmail } from "./email-suggestion";

describe("suggestEmail", () => {
  it("fixes the common typos of the big mailboxes", () => {
    expect(suggestEmail("anna@gmial.com")).toBe("anna@gmail.com");
    expect(suggestEmail("anna@gmail.co")).toBe("anna@gmail.com");
    expect(suggestEmail("anna@gmailcom")).toBe("anna@gmail.com");
    expect(suggestEmail("anna@gmail.it")).toBe("anna@gmail.com");
    expect(suggestEmail("anna@libbero.it")).toBe("anna@libero.it");
    expect(suggestEmail("anna@hotmial.it")).toBe("anna@hotmail.it");
    expect(suggestEmail("anna@outlok.com")).toBe("anna@outlook.com");
  });

  it("keeps the part before the @ and ignores case and spaces", () => {
    expect(suggestEmail("  Anna.Rossi+fin@GMAIL.CON ")).toBe("anna.rossi+fin@gmail.com");
  });

  it("leaves the right domains and other companies alone", () => {
    expect(suggestEmail("anna@gmail.com")).toBeNull();
    expect(suggestEmail("anna@hotmail.com")).toBeNull();
    expect(suggestEmail("anna@tin.it")).toBeNull();
    expect(suggestEmail("anna@acme.it")).toBeNull();
    expect(suggestEmail("anna@studio-rossi.eu")).toBeNull();
  });

  it("fixes only a broken ending on unknown domains", () => {
    expect(suggestEmail("anna@studio-rossi.con")).toBe("anna@studio-rossi.com");
    expect(suggestEmail("anna@studio-rossi.itt")).toBe("anna@studio-rossi.it");
  });

  it("waits for a complete address", () => {
    expect(suggestEmail("anna")).toBeNull();
    expect(suggestEmail("anna@")).toBeNull();
    expect(suggestEmail("@gmail.com")).toBeNull();
    expect(suggestEmail("anna@gmail.")).toBeNull();
    expect(suggestEmail("anna@gmail.c")).toBeNull();
  });
});
