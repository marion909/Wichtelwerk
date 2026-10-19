const TZ = "Europe/Vienna";

function parts(date: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value])) as Record<string, string>;
}

/** Date → Wert für <input type="datetime-local"> in Wiener Zeit. */
export function toViennaInput(date: Date | null | undefined): string {
  if (!date) return "";
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "2026-12-01T09:00" (Wiener Ortszeit) → Date (UTC-Instant). */
export function fromViennaInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Offset der Zeitzone an diesem Zeitpunkt ermitteln (Sommerzeit-sicher, zwei Iterationen).
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(guess));
    const seen = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    guess += asUtc - seen;
  }
  const date = new Date(guess);
  return Number.isNaN(date.getTime()) ? null : date;
}
