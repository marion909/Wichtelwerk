export interface CsvPerson {
  name: string;
  email: string;
  department: string | null;
  location: string | null;
}

export interface CsvResult {
  people: CsvPerson[];
  errors: { line: number; reason: "email" | "name" | "duplicate" }[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Zerlegt CSV (Trenner , ; oder Tab, Anführungszeichen) in Zeilen. */
export function parseCsvRows(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", ","].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const HEADERS: Record<string, keyof CsvPerson> = {
  name: "name",
  vorname: "name",
  "e-mail": "email",
  email: "email",
  mail: "email",
  abteilung: "department",
  department: "department",
  standort: "location",
  location: "location",
};

/** Liest Teilnehmer aus CSV: Spalten Name, E-Mail, Abteilung, Standort (Kopfzeile optional). */
export function parseParticipants(input: string): CsvResult {
  const rows = parseCsvRows(input);
  const people: CsvPerson[] = [];
  const errors: CsvResult["errors"] = [];
  if (rows.length === 0) return { people, errors };

  const head = rows[0].map((c) => HEADERS[c.trim().toLowerCase()]);
  const hasHeader = head.includes("email");
  const columns: (keyof CsvPerson)[] = hasHeader
    ? (head.map((h) => h) as (keyof CsvPerson)[])
    : ["name", "email", "department", "location"];
  const seen = new Set<string>();

  rows.slice(hasHeader ? 1 : 0).forEach((cells, idx) => {
    const line = idx + (hasHeader ? 2 : 1);
    const rec: Partial<Record<keyof CsvPerson, string>> = {};
    columns.forEach((col, i) => {
      if (col && cells[i] !== undefined) rec[col] = cells[i].trim();
    });
    const email = (rec.email ?? "").toLowerCase();
    if (!EMAIL.test(email)) return void errors.push({ line, reason: "email" });
    if (!rec.name) return void errors.push({ line, reason: "name" });
    if (seen.has(email)) return void errors.push({ line, reason: "duplicate" });
    seen.add(email);
    people.push({
      name: rec.name.slice(0, 120),
      email,
      department: rec.department ? rec.department.slice(0, 80) : null,
      location: rec.location ? rec.location.slice(0, 80) : null,
    });
  });
  return { people, errors };
}
