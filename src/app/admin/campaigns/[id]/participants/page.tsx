import Link from "next/link";
import { requireManagedCampaign } from "@/lib/access";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/shell";
import { Flash, type SearchParams } from "@/components/flash";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { addParticipant, importCsv, removeParticipant } from "../../actions";

export default async function ParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { user, campaign: c } = await requireManagedCampaign(id);
  const { t } = await getT();
  const sp = await searchParams;
  const list = await db.participant.findMany({
    where: { campaignId: id },
    include: { user: true },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  const editable = c.status === "draft" || c.status === "open";

  return (
    <PortalShell user={user} back={`/admin/campaigns/${id}/participants`}>
      <Link href={`/admin/campaigns/${id}`} className="text-sm font-bold text-muted hover:underline">← {c.title}</Link>
      <h1 className="mb-6 mt-2 text-2xl font-extrabold text-green">{t("campaign.participants")}</h1>
      <Flash searchParams={searchParams} />
      {sp.ok === "csv_imported" && (
        <p className="mb-5 rounded-xl border border-green/20 bg-green/5 px-4 py-3 text-sm font-semibold text-green">
          {t("csv.result", { added: String(sp.added ?? 0), errors: String(sp.errors ?? 0) })}
        </p>
      )}

      {editable && (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <form action={addParticipant} className="card space-y-3">
            <input type="hidden" name="id" value={id} />
            <h2 className="font-extrabold text-green">{t("participants.add")}</h2>
            <input name="name" required placeholder={t("participants.name")} className="input" aria-label={t("participants.name")} />
            <input name="email" type="email" required placeholder="E-Mail" className="input" aria-label="E-Mail" />
            <div className="grid grid-cols-2 gap-3">
              <input name="department" placeholder={t("participants.department")} className="input" aria-label={t("participants.department")} />
              <input name="location" placeholder={t("participants.location")} className="input" aria-label={t("participants.location")} />
            </div>
            <SubmitButton>{t("participants.add.submit")}</SubmitButton>
          </form>

          <form action={importCsv} className="card space-y-3">
            <input type="hidden" name="id" value={id} />
            <h2 className="font-extrabold text-green">{t("csv.title")}</h2>
            <p className="text-xs text-muted">{t("csv.hint")}</p>
            <input type="file" name="file" accept=".csv,text/csv,text/plain" className="text-sm" aria-label="CSV" />
            <textarea name="csv" rows={4} className="input font-mono text-xs" placeholder={"Name;E-Mail;Abteilung;Standort\nAnna Muster;anna@firma.at;Vertrieb;Wien"} aria-label="CSV" />
            <SubmitButton>{t("csv.submit")}</SubmitButton>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">{t("participants.name")}</th>
              <th className="px-4 py-3">E-Mail</th>
              <th className="px-4 py-3">{t("participants.department")}</th>
              <th className="px-4 py-3">{t("participants.status")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">{t("participants.empty")}</td></tr>
            )}
            {list.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-bold">{p.user.name ?? "–"}{p.lateJoiner && <span className="badge ml-2">{t("participants.late")}</span>}</td>
                <td className="px-4 py-3 text-muted">{p.user.email}</td>
                <td className="px-4 py-3 text-muted">{p.user.department ?? "–"}</td>
                <td className="px-4 py-3"><span className="badge">{t(`pstatus.${p.status}`)}</span></td>
                <td className="px-4 py-3 text-right">
                  {editable && (
                    <form action={removeParticipant}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="participantId" value={p.id} />
                      <ConfirmButton className="text-xs font-bold text-coral hover:underline" message={t("confirm.remove")}>{t("common.remove")}</ConfirmButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
