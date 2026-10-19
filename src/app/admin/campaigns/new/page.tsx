import { requireManager } from "@/lib/access";
import { PortalShell } from "@/components/shell";
import { CampaignForm } from "@/components/campaign-form";
import { Flash, type SearchParams } from "@/components/flash";
import { getT } from "@/lib/i18n/server";
import { atLeast } from "@/lib/plans";
import { createCampaign } from "../actions";

export default async function NewCampaignPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireManager();
  const { t } = await getT();
  const showLocation = user.role === "location_admin" || atLeast(user.organization.plan, "business");
  return (
    <PortalShell user={user} back="/admin/campaigns/new">
      <h1 className="mb-6 text-2xl font-extrabold text-green">{t("campaign.new")}</h1>
      <Flash searchParams={searchParams} />
      <CampaignForm
        action={createCampaign}
        showLocation={showLocation}
        locations={user.role === "location_admin" ? user.managedLocations : undefined}
      />
    </PortalShell>
  );
}
