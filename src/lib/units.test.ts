import { describe, expect, it } from "vitest";
import { parseParticipants } from "./csv";
import { decrypt, encrypt, pseudonym } from "./crypto";
import { fromViennaInput, toViennaInput } from "./time";
import { isAllowedWebhook } from "./notify";
import { signupOpen } from "./participation";
import { PLANS, atLeast, tierForParticipants } from "./plans";
import de from "./i18n/de";
import en from "./i18n/en";

describe("csv", () => {
  it("liest Semikolon-CSV mit Kopfzeile und meldet Fehler", () => {
    const res = parseParticipants(
      "Name;E-Mail;Abteilung;Standort\nAnna Muster;ANNA@firma.at;Vertrieb;Wien\nOhne Mail;kaputt;;\nAnna Doppelt;anna@firma.at;;\n\"Müller, Karl\";karl@firma.at;IT;Graz",
    );
    expect(res.people.map((p) => p.email)).toEqual(["anna@firma.at", "karl@firma.at"]);
    expect(res.people[1].name).toBe("Müller, Karl");
    expect(res.errors).toEqual([
      { line: 3, reason: "email" },
      { line: 4, reason: "duplicate" },
    ]);
  });

  it("liest CSV ohne Kopfzeile in der Reihenfolge Name, E-Mail, Abteilung, Standort", () => {
    const res = parseParticipants("Max,max@firma.at,HR,Linz");
    expect(res.people[0]).toMatchObject({ name: "Max", email: "max@firma.at", department: "HR", location: "Linz" });
  });
});

describe("crypto", () => {
  it("verschlüsselt und entschlüsselt, jeder Chiffretext ist verschieden", () => {
    const a = encrypt("Musterstraße 1\n1010 Wien");
    const b = encrypt("Musterstraße 1\n1010 Wien");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("Musterstraße 1\n1010 Wien");
  });

  it("erkennt Manipulation", () => {
    const parts = encrypt("geheim").split(".");
    parts[3] = Buffer.from("manipuliert").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("Pseudonyme sind stabil, groß-/kleinschreibungsunabhängig und je Firma verschieden", () => {
    expect(pseudonym("A@x.at", "o1")).toBe(pseudonym("a@x.at", "o1"));
    expect(pseudonym("a@x.at", "o1")).not.toBe(pseudonym("a@x.at", "o2"));
    expect(pseudonym("a@x.at", "o1")).not.toContain("a@x.at");
  });
});

describe("time", () => {
  it("rechnet Wiener Ortszeit korrekt um (Sommer- und Winterzeit)", () => {
    expect(fromViennaInput("2026-12-01T09:00")!.toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(fromViennaInput("2026-07-01T09:00")!.toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(toViennaInput(new Date("2026-12-01T08:00:00.000Z"))).toBe("2026-12-01T09:00");
  });
  it("lehnt ungültige Eingaben ab", () => {
    expect(fromViennaInput("morgen")).toBeNull();
  });
});

describe("webhooks", () => {
  it("lässt nur bekannte https-Ziele zu (SSRF-Schutz)", () => {
    expect(isAllowedWebhook("slack", "https://hooks.slack.com/services/T/B/x")).toBe(true);
    expect(isAllowedWebhook("slack", "http://hooks.slack.com/services/T/B/x")).toBe(false);
    expect(isAllowedWebhook("slack", "https://evil.example/hooks.slack.com")).toBe(false);
    expect(isAllowedWebhook("teams", "https://prod-12.westeurope.logic.azure.com/workflows/x")).toBe(true);
    expect(isAllowedWebhook("teams", "https://127.0.0.1/x")).toBe(false);
  });
});

describe("signupOpen", () => {
  const base = { signupDeadline: new Date("2026-12-01T10:00:00Z"), revealAt: new Date("2026-12-20T10:00:00Z"), allowLateJoin: true };
  it("offen bis zum Anmeldeschluss", () => {
    expect(signupOpen({ ...base, status: "open" }, new Date("2026-11-30T10:00:00Z"))).toBe(true);
    expect(signupOpen({ ...base, status: "open" }, new Date("2026-12-02T10:00:00Z"))).toBe(false);
  });
  it("Nachzügler nach der Ziehung nur wenn erlaubt", () => {
    expect(signupOpen({ ...base, status: "drawn" }, new Date("2026-12-05T10:00:00Z"))).toBe(true);
    expect(signupOpen({ ...base, allowLateJoin: false, status: "drawn" }, new Date("2026-12-05T10:00:00Z"))).toBe(false);
    expect(signupOpen({ ...base, status: "revealed" }, new Date("2026-12-05T10:00:00Z"))).toBe(false);
  });
});

describe("plans", () => {
  it("wählt das kleinste passende Paket", () => {
    expect(tierForParticipants(20)).toBe("free");
    expect(tierForParticipants(26)).toBe("team");
    expect(tierForParticipants(101)).toBe("business");
    expect(tierForParticipants(501)).toBe("enterprise");
    expect(atLeast("business", "team")).toBe(true);
    expect(PLANS.free.exclusionRules).toBe(false);
  });
});

describe("i18n", () => {
  const keys = Object.keys(de).sort();
  it("Deutsch und Englisch haben dieselben Schlüssel", () => {
    expect(Object.keys(en).sort()).toEqual(keys);
  });
  it("Platzhalter stimmen in beiden Sprachen überein", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of keys as (keyof typeof de)[]) {
      expect(vars(en[k]), k).toEqual(vars(de[k]));
    }
  });
});
