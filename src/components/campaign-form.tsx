import type { Campaign } from "@prisma/client";
import { getT } from "@/lib/i18n/server";
import { toViennaInput } from "@/lib/time";
import { SubmitButton } from "@/components/ui";

function inOneWeek(days: number, hour = 9) {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setHours(hour, 0, 0, 0);
  return toViennaInput(d);
}

export async function CampaignForm({
  action,
  campaign,
  locations,
  showLocation,
}: {
  action: (formData: FormData) => Promise<void>;
  campaign?: Campaign;
  locations?: string[];
  showLocation?: boolean;
}) {
  const { t } = await getT();
  return (
    <form action={action} className="card space-y-5">
      {campaign && <input type="hidden" name="id" value={campaign.id} />}
      <div>
        <label htmlFor="title" className="label">{t("campaign.title")}</label>
        <input id="title" name="title" required minLength={2} maxLength={120} defaultValue={campaign?.title} className="input" placeholder="Weihnachtswichteln 2026" />
      </div>
      <div>
        <label htmlFor="description" className="label">{t("campaign.description")}</label>
        <textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={campaign?.description ?? ""} className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="budget" className="label">{t("campaign.budget")}</label>
          <input id="budget" name="budget" required inputMode="decimal" defaultValue={campaign ? (campaign.budgetCents / 100).toString() : "20"} className="input" />
          <p className="hint">{t("campaign.budget.hint")}</p>
        </div>
        <div>
          <label htmlFor="mode" className="label">{t("campaign.mode")}</label>
          <select id="mode" name="mode" defaultValue={campaign?.mode ?? "onsite"} className="input">
            <option value="onsite">{t("mode.onsite")}</option>
            <option value="shipping">{t("mode.shipping")}</option>
            <option value="mixed">{t("mode.mixed")}</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="place" className="label">{t("campaign.place")}</label>
        <input id="place" name="place" maxLength={200} defaultValue={campaign?.place ?? ""} className="input" placeholder={t("campaign.place.hint")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="signupDeadline" className="label">{t("campaign.signupDeadline")}</label>
          <input id="signupDeadline" name="signupDeadline" type="datetime-local" required defaultValue={toViennaInput(campaign?.signupDeadline) || inOneWeek(14, 18)} className="input" />
        </div>
        <div>
          <label htmlFor="drawAt" className="label">{t("campaign.drawAt")}</label>
          <input id="drawAt" name="drawAt" type="datetime-local" required defaultValue={toViennaInput(campaign?.drawAt) || inOneWeek(15, 9)} className="input" />
        </div>
        <div>
          <label htmlFor="handoverAt" className="label">{t("campaign.handoverAt")}</label>
          <input id="handoverAt" name="handoverAt" type="datetime-local" defaultValue={toViennaInput(campaign?.handoverAt)} className="input" />
        </div>
        <div>
          <label htmlFor="revealAt" className="label">{t("campaign.revealAt")}</label>
          <input id="revealAt" name="revealAt" type="datetime-local" required defaultValue={toViennaInput(campaign?.revealAt) || inOneWeek(30, 16)} className="input" />
        </div>
      </div>
      <p className="hint">{t("campaign.timezone")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="deleteAfterDays" className="label">{t("campaign.deleteAfter")}</label>
          <input id="deleteAfterDays" name="deleteAfterDays" type="number" min={1} max={180} defaultValue={campaign?.deleteAfterDays ?? 30} className="input" />
          <p className="hint">{t("campaign.deleteAfter.hint")}</p>
        </div>
        {showLocation && !campaign && (
          <div>
            <label htmlFor="scopeLocation" className="label">{t("campaign.location")}</label>
            {locations && locations.length > 0 ? (
              <select id="scopeLocation" name="scopeLocation" className="input">
                {locations.map((l) => <option key={l}>{l}</option>)}
              </select>
            ) : (
              <input id="scopeLocation" name="scopeLocation" maxLength={80} className="input" placeholder={t("campaign.location.hint")} />
            )}
          </div>
        )}
      </div>
      {campaign && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="allowLateJoin" defaultChecked={campaign.allowLateJoin} />
          {t("campaign.lateJoin")}
        </label>
      )}
      <SubmitButton>{campaign ? t("common.save") : t("campaign.create")}</SubmitButton>
    </form>
  );
}
