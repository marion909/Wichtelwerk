import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/shell";
import { Flash, type SearchParams } from "@/components/flash";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n";
import { PLANS } from "@/lib/plans";
import { demoteManager, inviteManager, revokeInvite, updateLocations } from "./actions";

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdmin();
  const { t, locale } = await getT();
  const [managers, invites] = await Promise.all([
    db.user.findMany({ where: { organizationId: user.organizationId, role: { in: ["admin", "location_admin"] } }, orderBy: { createdAt: "asc" } }),
    db.adminInvite.findMany({ where: { organizationId: user.organizationId, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: "asc" } }),
  ]);
  const multiLocation = PLANS[user.organization.plan].multiLocation;

  return (
    <PortalShell user={user} back="/admin/team">
      <h1 className="mb-2 text-2xl font-extrabold text-green">{t("team.title")}</h1>
      <p className="mb-6 text-sm text-muted">{t("team.intro")}</p>
      <Flash searchParams={searchParams} />

      <div className="card mb-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <tbody>
            {managers.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3"><b>{m.name ?? "–"}</b><br /><span className="text-muted">{m.email}</span></td>
                <td className="px-4 py-3"><span className="badge">{t(`role.${m.role}`)}</span></td>
                <td className="px-4 py-3">
                  {m.role === "location_admin" && (
                    <form action={updateLocations} className="flex gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <input name="locations" defaultValue={m.managedLocations.join(", ")} className="input !py-1.5" aria-label={t("team.locations")} />
                      <SubmitButton className="btn-ghost !py-1.5">{t("common.save")}</SubmitButton>
                    </form>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {m.id !== user.id && (
                    <form action={demoteManager}>
                      <input type="hidden" name="id" value={m.id} />
                      <ConfirmButton className="text-xs font-bold text-coral hover:underline" message={t("confirm.demote")}>{t("team.demote")}</ConfirmButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invites.length > 0 && (
        <section className="card mb-6">
          <h2 className="mb-2 font-extrabold text-green">{t("team.pending")}</h2>
          <ul className="space-y-2 text-sm">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-xl bg-cream px-3 py-2">
                <span>{i.email} · {t(`role.${i.role}`)} · {t("team.expires", { date: formatDate(i.expiresAt, locale) })}</span>
                <form action={revokeInvite}><input type="hidden" name="id" value={i.id} /><button className="text-xs font-bold text-coral hover:underline">{t("common.remove")}</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form action={inviteManager} className="card space-y-4">
        <h2 className="font-extrabold text-green">{t("team.invite")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <input name="email" type="email" required placeholder="E-Mail" className="input" aria-label="E-Mail" />
          <select name="role" className="input" aria-label={t("team.role")}>
            <option value="admin">{t("role.admin")}</option>
            <option value="location_admin" disabled={!multiLocation}>{t("role.location_admin")}{multiLocation ? "" : " 🔒"}</option>
          </select>
          <input name="locations" placeholder={t("team.locations.hint")} className="input" aria-label={t("team.locations")} />
        </div>
        {!multiLocation && <p className="hint">{t("team.upgrade")}</p>}
        <SubmitButton>{t("team.invite.submit")}</SubmitButton>
      </form>
    </PortalShell>
  );
}
