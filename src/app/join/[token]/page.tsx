import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/access";
import { db } from "@/lib/db";
import { PublicShell } from "@/components/shell";
import { Flash, type SearchParams } from "@/components/flash";
import { SubmitButton } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n";
import { formatMoney } from "@/lib/plans";
import { signupOpen } from "@/lib/participation";
import { confirmJoin, declineJoin, requestJoin } from "./actions";

export const metadata = { title: "Wichtelaktion", robots: { index: false } };

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const { token } = await params;
  const campaign = await db.campaign.findUnique({ where: { inviteToken: token }, include: { organization: true } });
  if (!campaign || campaign.status === "draft") notFound();
  const { t, locale } = await getT();
  const user = await getCurrentUser();
  const open = signupOpen(campaign);
  const mine = user ? await db.participant.findUnique({ where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } } }) : null;
  const foreign = Boolean(user?.organizationId && user.organizationId !== campaign.organizationId);

  return (
    <PublicShell back={`/join/${token}`}>
      <div className="mx-auto max-w-lg">
        <p className="text-sm font-bold text-muted">{campaign.organization.name}</p>
        <h1 className="mb-2 text-3xl font-extrabold text-green">🎁 {campaign.title}</h1>
        {campaign.description && <p className="mb-4 whitespace-pre-line text-sm">{campaign.description}</p>}
        <ul className="mb-6 grid gap-1 text-sm text-muted">
          <li>💶 {t("join.budget", { amount: formatMoney(campaign.budgetCents, campaign.currency) })}</li>
          <li>⏰ {t("join.deadline", { date: formatDate(campaign.signupDeadline, locale, true) })}</li>
          <li>🎲 {t("join.draw", { date: formatDate(campaign.drawAt, locale, true) })}</li>
          {campaign.place && <li>📍 {campaign.place}</li>}
        </ul>
        <Flash searchParams={searchParams} />

        {!open ? (
          <p className="card text-center font-bold">{t("join.closed")}</p>
        ) : foreign ? (
          <p className="card text-center font-bold text-coral">{t("flash.other_org")}</p>
        ) : mine?.status === "joined" ? (
          <div className="card text-center">
            <p className="font-bold">✅ {t("join.already")}</p>
            <Link href={`/app/c/${campaign.id}`} className="btn-primary mt-4">{t("join.open")}</Link>
          </div>
        ) : user ? (
          <div className="card space-y-3">
            <p className="text-sm">{t("join.confirm", { email: user.email })}</p>
            <form action={confirmJoin} className="flex flex-wrap gap-3">
              <input type="hidden" name="token" value={token} />
              <SubmitButton>{t("join.yes")}</SubmitButton>
            </form>
            <form action={declineJoin}>
              <input type="hidden" name="token" value={token} />
              <button className="text-xs font-bold text-muted hover:underline">{t("join.no")}</button>
            </form>
          </div>
        ) : (
          <form action={requestJoin} className="card space-y-4">
            <input type="hidden" name="token" value={token} />
            <div>
              <label htmlFor="name" className="label">{t("participants.name")}</label>
              <input id="name" name="name" required maxLength={120} className="input" autoComplete="name" />
            </div>
            <div>
              <label htmlFor="email" className="label">{t("login.email")}</label>
              <input id="email" name="email" type="email" required className="input" autoComplete="email" />
            </div>
            <div>
              <label htmlFor="department" className="label">{t("participants.department")} <span className="font-normal text-muted">({t("common.optional")})</span></label>
              <input id="department" name="department" maxLength={80} className="input" />
            </div>
            <SubmitButton>{t("join.request")}</SubmitButton>
            <p className="hint">{t("join.privacy")}</p>
          </form>
        )}
      </div>
    </PublicShell>
  );
}
