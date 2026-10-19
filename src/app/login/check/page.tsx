import { PublicShell } from "@/components/shell";
import { getT } from "@/lib/i18n/server";
import type { SearchParams } from "@/components/flash";

export default async function CheckMailPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";
  const { t } = await getT();
  return (
    <PublicShell>
      <div className="card mx-auto max-w-md text-center">
        <p className="text-4xl" aria-hidden>📬</p>
        <h1 className="mt-2 text-xl font-extrabold text-green">{t("login.check.title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("login.check.body", { email })}</p>
        <p className="mt-4 text-xs text-muted">{t("login.check.hint")}</p>
      </div>
    </PublicShell>
  );
}
