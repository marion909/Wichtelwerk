import { randomInt } from "node:crypto";

/**
 * Ziehungs-Algorithmus: findet einen einzigen Zyklus über alle Teilnehmer
 * (A→B→C→…→A), in dem keine verbotene Kante vorkommt.
 *
 * Verbotene Kanten sind gerichtet: [giver, receiver]. Symmetrische Regeln
 * (gleiche Abteilung, manuelles Paar) werden vom Aufrufer in beide Richtungen
 * eingetragen.
 */

export type Edge = readonly [giver: string, receiver: string];

export type DrawResult =
  | { ok: true; pairs: Map<string, string> }
  | { ok: false; reasons: DrawFailure[] };

export type DrawFailure =
  | { code: "too_few"; min: number; actual: number }
  | { code: "group_too_large"; group: string; size: number; max: number }
  | { code: "no_receiver"; id: string }
  | { code: "no_giver"; id: string }
  | { code: "no_solution" };

export interface DrawOptions {
  /** Zeitbudget in Millisekunden. */
  timeoutMs?: number;
  /** Schritte pro Versuch, bevor mit neuer Zufallsreihenfolge neu gestartet wird. */
  stepsPerAttempt?: number;
}

export const MIN_PARTICIPANTS = 3;

function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildMatrix(ids: string[], forbidden: Iterable<Edge>) {
  const n = ids.length;
  const index = new Map(ids.map((id, i) => [id, i]));
  const allowed = new Uint8Array(n * n).fill(1);
  for (let i = 0; i < n; i++) allowed[i * n + i] = 0;
  for (const [g, r] of forbidden) {
    const gi = index.get(g);
    const ri = index.get(r);
    if (gi !== undefined && ri !== undefined) allowed[gi * n + ri] = 0;
  }
  return { n, allowed };
}

/** Erklärt, warum keine Ziehung möglich ist (für die Admin-Anzeige). */
export function diagnose(
  ids: string[],
  forbidden: Iterable<Edge>,
  groups?: Map<string, string | null | undefined>,
  sameGroupExcluded = false,
): DrawFailure[] {
  const reasons: DrawFailure[] = [];
  const { n, allowed } = buildMatrix(ids, forbidden);
  if (n < MIN_PARTICIPANTS) {
    return [{ code: "too_few", min: MIN_PARTICIPANTS, actual: n }];
  }
  if (sameGroupExcluded && groups) {
    const sizes = new Map<string, number>();
    for (const id of ids) {
      const g = groups.get(id);
      if (g) sizes.set(g, (sizes.get(g) ?? 0) + 1);
    }
    const max = Math.floor(n / 2);
    for (const [group, size] of sizes) {
      if (size > max) reasons.push({ code: "group_too_large", group, size, max });
    }
  }
  for (let i = 0; i < n; i++) {
    let out = 0;
    let inn = 0;
    for (let j = 0; j < n; j++) {
      out += allowed[i * n + j];
      inn += allowed[j * n + i];
    }
    if (out === 0) reasons.push({ code: "no_receiver", id: ids[i] });
    if (inn === 0) reasons.push({ code: "no_giver", id: ids[i] });
  }
  if (reasons.length === 0) reasons.push({ code: "no_solution" });
  return reasons;
}

export function drawCycle(
  ids: string[],
  forbidden: Iterable<Edge>,
  options: DrawOptions = {},
): DrawResult {
  const forbiddenList = Array.from(forbidden);
  const { n, allowed } = buildMatrix(ids, forbiddenList);
  if (n < MIN_PARTICIPANTS) {
    return { ok: false, reasons: [{ code: "too_few", min: MIN_PARTICIPANTS, actual: n }] };
  }

  const timeoutMs = options.timeoutMs ?? 3000;
  const stepsPerAttempt = options.stepsPerAttempt ?? Math.max(2000, n * 40);
  const deadline = Date.now() + timeoutMs;

  // Einfache Vorprüfung: jeder braucht mindestens einen möglichen Empfänger und Geber.
  const pre = diagnose(ids, forbiddenList);
  if (pre.some((r) => r.code === "no_receiver" || r.code === "no_giver")) {
    return { ok: false, reasons: pre };
  }

  const succ: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) if (allowed[i * n + j]) succ[i].push(j);
  }

  while (Date.now() < deadline) {
    const start = randomInt(n);
    const visited = new Uint8Array(n);
    // Anzahl möglicher Vorgänger unter {Endknoten des Pfades} ∪ {unbesuchte Knoten}.
    const predCount = new Int32Array(n);
    for (let i = 0; i < n; i++) for (const j of succ[i]) predCount[j]++;

    const path: number[] = [start];
    visited[start] = 1;
    let steps = 0;
    let aborted = false;

    const visit = (tail: number): boolean => {
      if (path.length === n) return allowed[tail * n + start] === 1;
      if (++steps > stepsPerAttempt || (steps & 255) === 0 && Date.now() > deadline) {
        aborted = true;
        return false;
      }

      const candidates = shuffle(succ[tail].filter((c) => !visited[c]));
      // Am stärksten eingeschränkte Empfänger zuerst (wenige mögliche Vorgänger).
      candidates.sort((a, b) => predCount[a] - predCount[b]);

      for (const c of candidates) {
        // tail gibt keinen weiteren Vorgänger mehr ab.
        for (const w of succ[tail]) predCount[w]--;
        visited[c] = 1;
        path.push(c);

        let dead = false;
        for (const w of succ[tail]) {
          if (!visited[w] && predCount[w] <= 0) {
            dead = true;
            break;
          }
        }
        if (!dead && visit(c)) return true;

        path.pop();
        visited[c] = 0;
        for (const w of succ[tail]) predCount[w]++;
        if (aborted) return false;
      }
      return false;
    };

    if (visit(start)) {
      const pairs = new Map<string, string>();
      for (let i = 0; i < n; i++) {
        pairs.set(ids[path[i]], ids[path[(i + 1) % n]]);
      }
      return { ok: true, pairs };
    }
    if (!aborted) break; // vollständig durchsucht: keine Lösung ab diesem Startknoten
  }

  return { ok: false, reasons: diagnose(ids, forbiddenList) };
}

/**
 * Nachzügler: fügt einen neuen Teilnehmer in einen bestehenden Zyklus ein
 * (A→B wird A→N→B), ohne andere Zuordnungen zu verändern.
 * Gibt null zurück, wenn keine regelkonforme Einfügestelle existiert.
 */
export function insertIntoCycle(
  pairs: Map<string, string>,
  newId: string,
  forbidden: Iterable<Edge>,
): Map<string, string> | null {
  const bad = new Set<string>();
  for (const [g, r] of forbidden) bad.add(`${g}>${r}`);
  const options = shuffle(Array.from(pairs.entries())).filter(
    ([g, r]) => !bad.has(`${g}>${newId}`) && !bad.has(`${newId}>${r}`),
  );
  if (options.length === 0) return null;
  const [giver, receiver] = options[0];
  const next = new Map(pairs);
  next.set(giver, newId);
  next.set(newId, receiver);
  return next;
}

/** Prüft, ob ein Ergebnis ein gültiger Einzelzyklus ohne verbotene Kante ist. */
export function isValidCycle(ids: string[], pairs: Map<string, string>, forbidden: Iterable<Edge>): boolean {
  if (pairs.size !== ids.length) return false;
  const bad = new Set<string>();
  for (const [g, r] of forbidden) bad.add(`${g}>${r}`);
  const receivers = new Set<string>();
  for (const id of ids) {
    const r = pairs.get(id);
    if (!r || r === id || bad.has(`${id}>${r}`) || receivers.has(r)) return false;
    receivers.add(r);
  }
  let cur = ids[0];
  for (let i = 0; i < ids.length; i++) {
    cur = pairs.get(cur)!;
    if (cur === ids[0]) return i === ids.length - 1;
  }
  return false;
}
