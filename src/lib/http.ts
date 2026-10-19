import { headers } from "next/headers";

/** Nur interne Pfade als Weiterleitungsziel zulassen. */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/app"): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
