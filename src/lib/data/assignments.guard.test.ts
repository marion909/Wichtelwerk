import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");
const ALLOWED = new Set([path.join(SRC, "lib/data/assignments.ts")]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("Geheimhaltung der Zuordnung", () => {
  const files = walk(SRC).filter((f) => !f.endsWith(".test.ts"));

  it("nur lib/data/assignments.ts greift auf assignment/message zu", () => {
    const offenders = files
      .filter((f) => !ALLOWED.has(f))
      .filter((f) => /\b(db|tx|prisma)\.(assignment|message)\b/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("keine Relation zur Zuordnung wird außerhalb des Datenmoduls geladen", () => {
    const offenders = files
      .filter((f) => !ALLOWED.has(f))
      .filter((f) => /\b(include|select)\s*:\s*\{[^}]*\b(given|received|assignments)\s*:\s*(true|\{)/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("Admin-Seiten importieren nur geheimnisschonende Funktionen", () => {
    const safe = new Set(["Feasibility", "checkDrawFeasibility","countAssignments", "runDraw", "listRevealed", "revealNext", "revealAll"]);
    const adminFiles = files.filter((f) => f.includes(`${path.sep}app${path.sep}admin${path.sep}`));
    for (const f of adminFiles) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/data\/assignments"/g)) {
        for (const name of m[1].split(",").map((s) => s.replace(/\btype\b/, "").trim()).filter(Boolean)) {
          expect(safe.has(name), `${path.relative(SRC, f)} importiert ${name}`).toBe(true);
        }
      }
    }
  });
});
