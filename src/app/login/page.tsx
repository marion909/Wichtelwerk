import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/access";
import { PublicShell } from "@/components/shell";
import { SubmitButton } from "@/components/ui";
import { Flash, type SearchParams } from "@/components/flash";
import { ssoProviders } from "@/auth";
import { getT } from "@/lib/i18n/server";
import { safeNext } from "@/lib/http";
import { requestLoginLink, ssoLogin } from "./actions";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  if (await getCurrentUser()) redirect(next);
  const { t } = await getT();

  return (
    <PublicShell back="/login">
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-2xl font-extrabold text-green">{t("login.title")}</h1>
        <p className="mb-6 text-sm text-muted">{t("login.intro")}</p>
        <Flash searchParams={searchParams} />
        <form action={requestLoginLink} className="card space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="email" className="label">{t("login.email")}</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="name@firma.at" />
          </div>
          <SubmitButton pendingLabel={t("login.sending")}>{t("login.submit")}</SubmitButton>
          <p className="hint">{t("login.nopassword")}</p>
        </form>

        {(ssoProviders.microsoft || ssoProviders.google) && (
          <div className="card mt-4 space-y-3">
            <p className="text-sm font-bold">{t("login.sso")}</p>
            <form action={ssoLogin} className="flex flex-wrap gap-2">
              <input type="hidden" name="next" value={next} />
              {ssoProviders.microsoft && <button name="provider" value="microsoft-entra-id" className="btn-ghost">Microsoft 365</button>}
              {ssoProviders.google && <button name="provider" value="google" className="btn-ghost">Google Workspace</button>}
            </form>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
