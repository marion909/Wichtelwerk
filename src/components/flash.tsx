import { getT } from "@/lib/i18n/server";
import type { TKey } from "@/lib/i18n";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Zeigt Rückmeldungen aus ?ok=<code> bzw. ?err=<code> (Codes sind Schlüssel `flash.<code>`). */
export async function Flash({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ok = pick(sp.ok);
  const err = pick(sp.err);
  const { t } = await getT();
  if (!ok && !err) return null;
  const code = (ok ?? err)!.replace(/[^a-z_0-9]/gi, "");
  const text = t(`flash.${code}` as TKey);
  if (text === `flash.${code}`) return null;
  return (
    <p
      role={err ? "alert" : "status"}
      className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${
        err ? "border-coral/40 bg-coral/10 text-coral" : "border-green/20 bg-green/5 text-green"
      }`}
    >
      {text}
    </p>
  );
}

export function flashUrl(path: string, kind: "ok" | "err", code: string): string {
  const url = new URL(path, "http://x");
  url.searchParams.set(kind, code);
  return `${url.pathname}${url.search}`;
}
