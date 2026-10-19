import { redirect } from "next/navigation";
import { requireUser } from "@/lib/access";
import { PublicShell } from "@/components/shell";
import { SubmitButton } from "@/components/ui";
import { Flash, type SearchParams } from "@/components/flash";
import { getT } from "@/lib/i18n/server";
import { createOrganization } from "./actions";

export default async function OnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/onboarding");
  if (user.organizationId) redirect("/app");
  const { t } = await getT();
  return (
    <PublicShell back="/onboarding">
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-2xl font-extrabold text-green">{t("onboarding.title")}</h1>
        <p className="mb-6 text-sm text-muted">{t("onboarding.intro")}</p>
        <Flash searchParams={searchParams} />
        <form action={createOrganization} className="card space-y-4">
          <div>
            <label htmlFor="organization" className="label">{t("onboarding.org")}</label>
            <input id="organization" name="organization" required minLength={2} maxLength={120} className="input" />
          </div>
          <div>
            <label htmlFor="name" className="label">{t("onboarding.name")}</label>
            <input id="name" name="name" required minLength={2} maxLength={120} defaultValue={user.name ?? ""} className="input" autoComplete="name" />
          </div>
          <div>
            <label htmlFor="uid" className="label">{t("onboarding.uid")}</label>
            <input id="uid" name="uid" maxLength={20} placeholder="ATU12345678" className="input" />
            <p className="hint">{t("onboarding.uid.hint")}</p>
          </div>
          <SubmitButton>{t("onboarding.submit")}</SubmitButton>
        </form>
      </div>
    </PublicShell>
  );
}
