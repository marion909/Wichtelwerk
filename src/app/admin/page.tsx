import Link from "next/link";
import { campaignScopeFilter, requireManager } from "@/lib/access";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/shell";
import { Flash, type SearchParams } from "@/components/flash";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n";

export default async function AdminHome({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireManager();
  const { t, locale } = await getT();
  const campaigns = await db.campaign.findMany({
    where: campaignScopeFilter(user),
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { participants: { where: { status: "joined" } } } } },
  });

  return (
    <PortalShell user={user} back="/admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-green">{t("admin.title")}</h1>
        <Link href="/admin/campaigns/new" className="btn-accent">+ {t("campaign.new")}</Link>
      </div>
      <Flash searchParams={searchParams} />
      {campaigns.length === 0 ? (
        <div className="card text-center">
          <p className="text-4xl" aria-hidden>🎁</p>
          <p className="mt-2 font-bold">{t("admin.empty")}</p>
          <p className="mt-1 text-sm text-muted">{t("admin.empty.hint")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/campaigns/${c.id}`} className="card block transition hover:border-brand">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-green">{c.title}</h2>
                  <span className="badge">{t(`status.${c.status}`)}</span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {t("admin.participants", { n: c._count.participants })} · {t("admin.draw")}: {formatDate(c.drawAt, locale, true)}
                </p>
                {c.scopeLocation && <p className="mt-1 text-xs text-muted">📍 {c.scopeLocation}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PortalShell>
  );
}
