import Link from "next/link";
import { requireManagedCampaign } from "@/lib/access";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/shell";
import { Flash, type SearchParams } from "@/components/flash";
import { SubmitButton } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { planFor } from "@/lib/plans";
import { addPairRule, removeRule, saveRuleFlags } from "../../actions";

export default async function RulesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { user, campaign: c } = await requireManagedCampaign(id);
  const { t } = await getT();
  const allowed = planFor(c.tier).exclusionRules;
  const editable = c.status === "draft" || c.status === "open";
  const [rules, people, previous] = await Promise.all([
    db.exclusionRule.findMany({ where: { campaignId: id, type: "pair" } }),
    db.participant.findMany({ where: { campaignId: id, status: { not: "declined" } }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    db.previousPair.count({ where: { organizationId: c.organizationId } }),
  ]);
  const name = new Map(people.map((p) => [p.id, p.user.name ?? p.user.email]));

  return (
    <PortalShell user={user} back={`/admin/campaigns/${id}/rules`}>
      <Link href={`/admin/campaigns/${id}`} className="text-sm font-bold text-muted hover:underline">← {c.title}</Link>
      <h1 className="mb-6 mt-2 text-2xl font-extrabold text-green">{t("campaign.rules")}</h1>
      <Flash searchParams={searchParams} />
      {!allowed && <p className="mb-5 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm font-semibold">🔒 {t("rules.upgrade")}</p>}

      <form action={saveRuleFlags} className="card mb-6 space-y-3">
        <input type="hidden" name="id" value={id} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="excludeSameDepartment" defaultChecked={c.excludeSameDepartment} disabled={!allowed || !editable} className="mt-1" />
          <span><b>{t("rules.sameDept")}</b><br /><span className="text-muted">{t("rules.sameDept.hint")}</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="excludePreviousYear" defaultChecked={c.excludePreviousYear} disabled={!allowed || !editable} className="mt-1" />
          <span><b>{t("rules.previous")}</b><br /><span className="text-muted">{t("rules.previous.hint", { n: previous })}</span></span>
        </label>
        {allowed && editable && <SubmitButton className="btn-ghost">{t("common.save")}</SubmitButton>}
      </form>

      <section className="card">
        <h2 className="mb-3 font-extrabold text-green">{t("rules.pairs")}</h2>
        <p className="mb-3 text-sm text-muted">{t("rules.pairs.hint")}</p>
        <ul className="mb-4 space-y-2 text-sm">
          {rules.length === 0 && <li className="text-muted">{t("rules.pairs.empty")}</li>}
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-xl bg-cream px-3 py-2">
              <span>{name.get(r.participantAId ?? "") ?? "?"} ↔ {name.get(r.participantBId ?? "") ?? "?"}</span>
              {editable && (
                <form action={removeRule}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="ruleId" value={r.id} />
                  <button className="text-xs font-bold text-coral hover:underline">{t("common.remove")}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {allowed && editable && (
          <form action={addPairRule} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={id} />
            <select name="a" required className="input max-w-56" aria-label="A">
              {people.map((p) => <option key={p.id} value={p.id}>{p.user.name ?? p.user.email}</option>)}
            </select>
            <span aria-hidden>↔</span>
            <select name="b" required className="input max-w-56" aria-label="B">
              {people.map((p) => <option key={p.id} value={p.id}>{p.user.name ?? p.user.email}</option>)}
            </select>
            <SubmitButton className="btn-ghost">{t("rules.pairs.add")}</SubmitButton>
          </form>
        )}
      </section>
    </PortalShell>
  );
}
