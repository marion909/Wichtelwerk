import Link from "next/link";
import { requireOrgUser } from "@/lib/access";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/shell";
import { Flash, type SearchParams } from "@/components/flash";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n";

export default async function MemberHome({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireOrgUser("/app");
  const { t, locale } = await getT();
  const mine = await db.participant.findMany({
    where: { userId: user.id, status: { in: ["invited", "joined"] }, campaign: { status: { not: "draft" } } },
    include: { campaign: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PortalShell user={user} back="/app">
      <h1 className="mb-6 text-2xl font-extrabold text-green">{t("nav.mine")}</h1>
      <Flash searchParams={searchParams} />
      {mine.length === 0 ? (
        <div className="card text-center">
          <p className="text-4xl" aria-hidden>🎄</p>
          <p className="mt-2 font-bold">{t("member.empty")}</p>
          <p className="mt-1 text-sm text-muted">{t("member.empty.hint")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {mine.map((p) => (
            <li key={p.id}>
              <Link
                href={p.status === "joined" ? `/app/c/${p.campaignId}` : `/join/${p.campaign.inviteToken}`}
                className="card block transition hover:border-brand"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-green">{p.campaign.title}</h2>
                  <span className="badge">{p.status === "invited" ? t("pstatus.invited") : t(`status.${p.campaign.status}`)}</span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {p.status === "invited"
                    ? t("member.invited", { date: formatDate(p.campaign.signupDeadline, locale, true) })
                    : p.campaign.status === "open"
                      ? t("participant.waitDraw", { date: formatDate(p.campaign.drawAt, locale, true) })
                      : t("member.open")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PortalShell>
  );
}
