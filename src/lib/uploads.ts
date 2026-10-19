import path from "node:path";

/** Verzeichnis für hochgeladene Firmenlogos (nicht öffentlich, Auslieferung über /api/org-logo). */
export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
}
