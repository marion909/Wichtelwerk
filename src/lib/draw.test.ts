import { describe, expect, it } from "vitest";
import { diagnose, drawCycle, insertIntoCycle, isValidCycle, type Edge } from "./draw";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

function sameGroupEdges(all: string[], group: (id: string) => string): Edge[] {
  const edges: Edge[] = [];
  for (const a of all) for (const b of all) if (a !== b && group(a) === group(b)) edges.push([a, b]);
  return edges;
}

describe("drawCycle", () => {
  it("liefert einen gültigen Einzelzyklus ohne Selbstzuordnung", () => {
    for (const n of [3, 4, 5, 10, 50]) {
      const all = ids(n);
      const res = drawCycle(all, []);
      expect(res.ok).toBe(true);
      if (res.ok) expect(isValidCycle(all, res.pairs, [])).toBe(true);
    }
  });

  it("lehnt weniger als 3 Teilnehmer ab", () => {
    const res = drawCycle(ids(2), []);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reasons[0].code).toBe("too_few");
  });

  it("berücksichtigt Abteilungs-, Paar- und Vorjahresregeln", () => {
    const all = ids(12);
    const dept = (id: string) => `d${Number(id.slice(1)) % 4}`;
    const forbidden: Edge[] = [
      ...sameGroupEdges(all, dept),
      ["p0", "p1"],
      ["p1", "p0"],
      ["p2", "p3"],
    ];
    for (let i = 0; i < 20; i++) {
      const res = drawCycle(all, forbidden);
      expect(res.ok).toBe(true);
      if (res.ok) expect(isValidCycle(all, res.pairs, forbidden)).toBe(true);
    }
  });

  it("findet Lösungen auch bei 500 Teilnehmern mit Abteilungsregel", () => {
    const all = ids(500);
    const forbidden = sameGroupEdges(all, (id) => `d${Number(id.slice(1)) % 25}`);
    const t = Date.now();
    const res = drawCycle(all, forbidden);
    expect(res.ok).toBe(true);
    if (res.ok) expect(isValidCycle(all, res.pairs, forbidden)).toBe(true);
    expect(Date.now() - t).toBeLessThan(3000);
  });

  it("meldet eine zu große Abteilung als blockierende Regel", () => {
    const all = ids(6);
    const dept = (id: string) => (Number(id.slice(1)) < 4 ? "A" : "B");
    const forbidden = sameGroupEdges(all, dept);
    const res = drawCycle(all, forbidden, { timeoutMs: 500 });
    expect(res.ok).toBe(false);
    const groups = new Map(all.map((id) => [id, dept(id)]));
    const reasons = diagnose(all, forbidden, groups, true);
    expect(reasons).toContainEqual({ code: "group_too_large", group: "A", size: 4, max: 3 });
  });

  it("erkennt Teilnehmer ohne möglichen Empfänger", () => {
    const all = ids(4);
    const forbidden: Edge[] = [["p0", "p1"], ["p0", "p2"], ["p0", "p3"]];
    const res = drawCycle(all, forbidden);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reasons).toContainEqual({ code: "no_receiver", id: "p0" });
  });
});

describe("insertIntoCycle", () => {
  it("fügt Nachzügler ein, ohne andere Paare zu ändern", () => {
    const all = ids(6);
    const res = drawCycle(all, []);
    if (!res.ok) throw new Error("draw failed");
    const next = insertIntoCycle(res.pairs, "late", [])!;
    expect(isValidCycle([...all, "late"], next, [])).toBe(true);
    let changed = 0;
    for (const [g, r] of res.pairs) if (next.get(g) !== r) changed++;
    expect(changed).toBe(1);
  });

  it("gibt null zurück, wenn keine regelkonforme Stelle existiert", () => {
    const res = drawCycle(ids(3), []);
    if (!res.ok) throw new Error("draw failed");
    const forbidden: Edge[] = ids(3).flatMap((id) => [[id, "late"], ["late", id]] as Edge[]);
    expect(insertIntoCycle(res.pairs, "late", forbidden)).toBeNull();
  });
});
