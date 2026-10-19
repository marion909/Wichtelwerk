import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/shell";
import { Flash, type SearchParams } from "@/components/flash";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { PLANS } from "@/lib/plans";
import { ssoProviders } from "@/auth";
import { addSsoDomain, removeSsoDomain, saveBranding, saveOrganization, saveWebhooks, verifySsoDomain } from "./actions";

function Locked({ text }: { text: string }) {
  return <p className="mb-3 rounded-xl border border-gold/50 bg-gold/10 px-3 py-2 text-xs font-semibold">🔒 {text}</p>;
}

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdmin();
  const { t } = await getT();
  const org = user.organization;
  const plan = PLANS[org.plan];
  const domains = await db.ssoDomain.findMany({ where: { organizationId: org.id }, orderBy: { domain: "asc" } });

  return (
    <PortalShell user={user} back="/admin/settings">
      <h1 className="mb-6 text-2xl font-extrabold text-green">{t("settings.title")}</h1>
      <Flash searchParams={searchParams} />

      <form action={saveOrganization} className="card mb-6 space-y-4">
        <h2 className="font-extrabold text-green">{t("settings.org")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="name">{t("onboarding.org")}</label><input id="name" name="name" required defaultValue={org.name} className="input" /></div>
          <div><label className="label" htmlFor="uid">{t("onboarding.uid")}</label><input id="uid" name="uid" defaultValue={org.uidNummer ?? ""} className="input" placeholder="ATU12345678" /></div>
        </div>
        <p className="text-xs text-muted">{t("settings.plan", { plan: t(`plan.${org.plan}`) })}</p>
        <SubmitButton>{t("common.save")}</SubmitButton>
      </form>

      <form action={saveBranding} className="card mb-6 space-y-4">
        <h2 className="font-extrabold text-green">🎨 {t("settings.branding")}</h2>
        {!plan.branding && <Locked text={t("settings.branding.locked")} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="brandColor">{t("settings.color")}</label>
            <input id="brandColor" name="brandColor" type="color" defaultValue={org.brandColor ?? "#173f35"} disabled={!plan.branding} className="h-11 w-24 rounded-lg border border-line" />
          </div>
          <div>
            <label className="label" htmlFor="logo">{t("settings.logo")}</label>
            <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={!plan.branding} className="text-sm" />
            <p className="hint">{t("settings.logo.hint")}</p>
            {org.logoUrl && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" name="removeLogo" /> {t("settings.logo.remove")}</label>}
          </div>
        </div>
        {plan.branding && <SubmitButton>{t("common.save")}</SubmitButton>}
      </form>

      <form action={saveWebhooks} className="card mb-6 space-y-4">
        <h2 className="font-extrabold text-green">🔔 {t("settings.webhooks")}</h2>
        <p className="text-xs text-muted">{t("settings.webhooks.hint")}</p>
        <div><label className="label" htmlFor="slack">Slack</label><input id="slack" name="slack" defaultValue={org.slackWebhookUrl ?? ""} className="input" placeholder="https://hooks.slack.com/services/…" /></div>
        <div><label className="label" htmlFor="teams">Microsoft Teams</label><input id="teams" name="teams" defaultValue={org.teamsWebhookUrl ?? ""} className="input" placeholder="https://….logic.azure.com/…" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="test" /> {t("settings.webhooks.test")}</label>
        <SubmitButton>{t("common.save")}</SubmitButton>
      </form>

      <section className="card mb-6 space-y-4">
        <h2 className="font-extrabold text-green">🔐 {t("settings.sso")}</h2>
        {!plan.sso && <Locked text={t("settings.sso.locked")} />}
        {!ssoProviders.microsoft && !ssoProviders.google && <p className="text-xs text-muted">{t("settings.sso.noProvider")}</p>}
        <ul className="space-y-3 text-sm">
          {domains.map((d) => (
            <li key={d.id} className="rounded-xl bg-cream p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b>{d.domain}</b>
                <span className="badge">{d.verifiedAt ? `✅ ${t("settings.sso.verified")}` : t("settings.sso.pending")}</span>
              </div>
              {!d.verifiedAt && (
                <div className="mt-2 text-xs text-muted">
                  <p>{t("settings.sso.dns")}</p>
                  <code className="mt-1 block break-all rounded bg-surface p-2">_wichtelwerk.{d.domain} TXT wichtelwerk-verify={d.verifyToken}</code>
                </div>
              )}
              {d.entraTenantId && <p className="mt-1 text-xs text-muted">Entra Tenant: {d.entraTenantId}</p>}
              <div className="mt-2 flex gap-2">
                {!d.verifiedAt && <form action={verifySsoDomain}><input type="hidden" name="id" value={d.id} /><SubmitButton className="btn-ghost !py-1.5">{t("settings.sso.check")}</SubmitButton></form>}
                <form action={removeSsoDomain}><input type="hidden" name="id" value={d.id} /><ConfirmButton className="text-xs font-bold text-coral hover:underline" message={t("confirm.remove")}>{t("common.remove")}</ConfirmButton></form>
              </div>
            </li>
          ))}
        </ul>
        {plan.sso && (
          <form action={addSsoDomain} className="grid gap-3 sm:grid-cols-3">
            <input name="domain" required placeholder="firma.at" className="input" aria-label="Domain" />
            <input name="tenant" placeholder={t("settings.sso.tenant")} className="input" aria-label="Entra Tenant ID" />
            <SubmitButton className="btn-ghost">{t("settings.sso.add")}</SubmitButton>
          </form>
        )}
      </section>
    </PortalShell>
  );
}
