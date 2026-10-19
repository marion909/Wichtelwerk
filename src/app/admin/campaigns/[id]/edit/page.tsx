import Link from "next/link";
import { requireManagedCampaign } from "@/lib/access";
import { PortalShell } from "@/components/shell";
import { CampaignForm } from "@/components/campaign-form";
import { Flash, type SearchParams } from "@/components/flash";
import { getT } from "@/lib/i18n/server";
import { updateCampaign } from "../../actions";

export default async function EditCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { user, campaign } = await requireManagedCampaign(id);
  const { t } = await getT();
  return (
    <PortalShell user={user} back={`/admin/campaigns/${id}/edit`}>
      <Link href={`/admin/campaigns/${id}`} className="text-sm font-bold text-muted hover:underline">← {campaign.title}</Link>
      <h1 className="mb-6 mt-2 text-2xl font-extrabold text-green">{t("campaign.edit")}</h1>
      <Flash searchParams={searchParams} />
      <CampaignForm action={updateCampaign} campaign={campaign} />
    </PortalShell>
  );
}
