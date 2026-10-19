import Link from "next/link";
import { requireManagedCampaign } from "@/lib/access";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/shell";
import { Flash, type SearchParams } from "@/components/flash";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { getT } from "@/lib/i18n/server";
import { formatDate, type Translator } from "@/lib/i18n";
import { appUrl } from "@/lib/mail";
import { PAID_TIERS, PLANS, formatMoney, planFor } from "@/lib/plans";
import { checkDrawFeasibility, countAssignments, type Feasibility } from "@/lib/data/assignments";
import { stripeConfigured } from "@/lib/stripe";
import {
  closeNow,
  deleteCampaign,
  drawNow,
  openCampaign,
  saveExtras,
  startCheckout,
  startRevealAction,
} from "../actions";

function feasibilityText(f: Extract<Feasibility, { ok: false }>, t: Translator): string[] {
  return f.reasons.map((r) => {
    switch (r.code) {
      case "too_few":
        return t("diag.too_few", { min: r.min, n: r.actual });
      case "group_too_large":
        return t("diag.group_too_large", { group: r.group, size: r.size, max: r.max });
      case "no_receiver":
        return t("diag.no_receiver", { name: f.names[r.id] ?? "?" });
      case "no_giver":
        return t("diag.no_giver", { name: f.names[r.id] ?? "?" });
      default:
        return t("diag.no_solution");
    }
  });
}

export default async function CampaignOverview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { user, campaign: c } = await requireManagedCampaign(id);
  const { t, locale } = await getT();
  const plan = planFor(c.tier);

  const participants = await db.participant.findMany({
    where: { campaignId: id },
    include: { user: true, wishlist: true },
  });
  const joined = participants.filter((p) => p.status === "joined");
  const invited = participants.filter((p) => p.status === "invited");
  const declined = participants.filter((p) => p.status === "declined");
  const missingWishlist = joined.filter(
    (p) => !p.wishlist || (!p.wishlist.text.trim() && p.wishlist.tags.length === 0 && p.wishlist.links.length === 0),
  );
  const missingAddress = c.mode === "onsite" ? [] : joined.filter((p) => !p.shippingAddressEnc);
  const assigned = c.status === "draft" || c.status === "open" ? 0 : await countAssignments(id);
  const unplaced = c.status === "drawn" ? Math.max(0, joined.length - assigned) : 0;
  const feasibility = c.status === "open" ? await checkDrawFeasibility(id) : null;
  const feedback =
    c.status === "revealed" || c.status === "closed"
      ? await db.feedback.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" } })
      : [];
  const joinUrl = appUrl(`/join/${c.inviteToken}`);
  const overLimit = joined.length > plan.maxParticipants;

  return (
    <PortalShell user={user} back={`/admin/campaigns/${id}`}>
      <Link href="/admin" className="text-sm font-bold text-muted hover:underline">← {t("admin.title")}</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-green">{c.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="badge">{t(`status.${c.status}`)}</span>
            <span className="badge">{t(`plan.${c.tier}`)}</span>
            <span>{formatMoney(c.budgetCents, c.currency)}</span>
            {c.scopeLocation && <span>📍 {c.scopeLocation}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(c.status === "draft" || c.status === "open") && <Link href={`/admin/campaigns/${id}/edit`} className="btn-ghost">{t("common.edit")}</Link>}
          <Link href={`/admin/campaigns/${id}/participants`} className="btn-ghost">{t("campaign.participants")}</Link>
          <Link href={`/admin/campaigns/${id}/rules`} className="btn-ghost">{t("campaign.rules")}</Link>
        </div>
      </div>

      <Flash searchParams={searchParams} />

      {/* Ablauf */}
      <section className="card mb-6">
        <h2 className="mb-3 text-lg font-extrabold text-green">{t("campaign.flow")}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div><dt className="font-bold">{t("campaign.signupDeadline")}</dt><dd className="text-muted">{formatDate(c.signupDeadline, locale, true)}</dd></div>
          <div><dt className="font-bold">{t("campaign.drawAt")}</dt><dd className="text-muted">{formatDate(c.drawAt, locale, true)}</dd></div>
          <div><dt className="font-bold">{t("campaign.handoverAt")}</dt><dd className="text-muted">{c.handoverAt ? formatDate(c.handoverAt, locale, true) : "–"}</dd></div>
          <div><dt className="font-bold">{t("campaign.revealAt")}</dt><dd className="text-muted">{formatDate(c.revealAt, locale, true)}</dd></div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4">
          {c.status === "draft" && (
            <>
              <form action={openCampaign}><input type="hidden" name="id" value={id} /><SubmitButton>{t("action.open")}</SubmitButton></form>
              <form action={deleteCampaign}><input type="hidden" name="id" value={id} /><ConfirmButton message={t("confirm.delete")}>{t("common.delete")}</ConfirmButton></form>
            </>
          )}
          {c.status === "open" && (
            <form action={drawNow}>
              <input type="hidden" name="id" value={id} />
              <ConfirmButton className="btn-accent" message={t("confirm.draw")}>{t("action.draw")}</ConfirmButton>
            </form>
          )}
          {c.status === "drawn" && (
            <form action={startRevealAction}>
              <input type="hidden" name="id" value={id} />
              <ConfirmButton className="btn-accent" message={t("confirm.reveal")}>{plan.revealMode ? t("action.reveal.live") : t("action.reveal.all")}</ConfirmButton>
            </form>
          )}
          {c.status === "revealed" && (
            <>
              {plan.revealMode && <Link href={`/admin/campaigns/${id}/reveal`} className="btn-accent">{t("action.reveal.open")}</Link>}
              <form action={closeNow}><input type="hidden" name="id" value={id} /><ConfirmButton message={t("confirm.close")}>{t("action.close")}</ConfirmButton></form>
            </>
          )}
          {c.status === "closed" && <p className="text-sm text-muted">{t("campaign.closed.info")}</p>}
        </div>
        {c.status === "drawn" && <p className="mt-3 text-xs text-muted">{t("campaign.secret.info")}</p>}
      </section>

      {/* Ziehung möglich? */}
      {feasibility && (
        <section className={`card mb-6 ${feasibility.ok ? "" : "border-coral/50"}`}>
          <h2 className="mb-2 text-lg font-extrabold text-green">{t("campaign.check")}</h2>
          {feasibility.ok ? (
            <p className="text-sm">✅ {t("campaign.check.ok", { n: feasibility.count })}</p>
          ) : (
            <>
              <p className="mb-2 text-sm font-bold text-coral">⚠️ {t("campaign.check.fail")}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {feasibilityText(feasibility, t).map((line) => <li key={line}>{line}</li>)}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Dashboard */}
      <section className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          [t("dash.joined"), joined.length],
          [t("dash.invited"), invited.length],
          [t("dash.declined"), declined.length],
          [t("dash.missingWishlist"), missingWishlist.length],
        ].map(([label, value]) => (
          <div key={label as string} className="card text-center">
            <p className="text-3xl font-extrabold text-green">{value}</p>
            <p className="text-xs font-bold text-muted">{label}</p>
          </div>
        ))}
      </section>

      {overLimit && <p className="mb-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">{t("dash.overLimit", { max: plan.maxParticipants })}</p>}
      {unplaced > 0 && <p className="mb-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">{t("dash.unplaced", { n: unplaced })}</p>}

      {(missingWishlist.length > 0 || missingAddress.length > 0) && (c.status === "open" || c.status === "drawn") && (
        <section className="card mb-6">
          {missingWishlist.length > 0 && (
            <>
              <h3 className="font-extrabold text-green">{t("dash.missingWishlist")}</h3>
              <p className="mb-2 text-sm text-muted">{missingWishlist.map((p) => p.user.name ?? p.user.email).join(", ")}</p>
            </>
          )}
          {missingAddress.length > 0 && (
            <>
              <h3 className="font-extrabold text-green">{t("dash.missingAddress")}</h3>
              <p className="text-sm text-muted">{missingAddress.map((p) => p.user.name ?? p.user.email).join(", ")}</p>
            </>
          )}
        </section>
      )}

      {/* Einladungslink */}
      {(c.status === "open" || c.status === "draft") && (
        <section className="card mb-6">
          <h2 className="mb-2 text-lg font-extrabold text-green">{t("campaign.invite")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={joinUrl} className="input max-w-xl flex-1" aria-label={t("campaign.invite")} />
            <CopyButton value={joinUrl} />
          </div>
          <p className="hint">{t("campaign.invite.hint")}</p>
        </section>
      )}

      {/* Paket */}
      {c.status !== "closed" && (
        <section className="card mb-6">
          <h2 className="mb-2 text-lg font-extrabold text-green">{t("plan.title")}</h2>
          <p className="mb-3 text-sm text-muted">
            {t("plan.current", { plan: t(`plan.${c.tier}`), max: plan.maxParticipants > 100000 ? "∞" : plan.maxParticipants })}
            {c.paidAt && ` · ${t("plan.paidAt", { date: formatDate(c.paidAt, locale) })}`}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {PAID_TIERS.filter((tier) => PLANS[tier].maxParticipants > plan.maxParticipants).map((tier) => (
              <form key={tier} action={startCheckout} className="rounded-xl border border-line p-4">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="tier" value={tier} />
                <p className="font-extrabold">{t(`plan.${tier}`)}</p>
                <p className="text-sm text-muted">{t("plan.upTo", { n: PLANS[tier].maxParticipants })}</p>
                <p className="my-2 text-xl font-extrabold text-green">{formatMoney(PLANS[tier].priceCents!, "EUR", locale === "de" ? "de-AT" : "en-GB")} <span className="text-xs font-semibold text-muted">{t("plan.net")}</span></p>
                <SubmitButton className="btn-primary w-full">{t("plan.buy")}</SubmitButton>
                {!stripeConfigured() && <p className="hint">{t("plan.payments_off")}</p>}
              </form>
            ))}
            {c.tier !== "enterprise" && (
              <div className="rounded-xl border border-dashed border-line p-4">
                <p className="font-extrabold">{t("plan.enterprise")}</p>
                <p className="my-2 text-sm text-muted">{t("plan.enterprise.info")}</p>
                <a className="btn-ghost w-full" href="mailto:hallo@neuhauser.cloud?subject=Wichtelwerk%20Enterprise">{t("plan.contact")}</a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* V2-Optionen */}
      {(c.status === "draft" || c.status === "open" || c.status === "drawn") && (
        <section className="card mb-6">
          <h2 className="mb-2 text-lg font-extrabold text-green">{t("extras.title")}</h2>
          <form action={saveExtras} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="guessGameEnabled" defaultChecked={c.guessGameEnabled} className="mt-1" /><span><b>{t("extras.guess")}</b><br /><span className="text-muted">{t("extras.guess.hint")}</span></span></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="vouchersEnabled" defaultChecked={c.vouchersEnabled} disabled={c.mode === "onsite"} className="mt-1" /><span><b>{t("extras.vouchers")}</b><br /><span className="text-muted">{c.mode === "onsite" ? t("extras.vouchers.onsite") : t("extras.vouchers.hint")}</span></span></label>
            <SubmitButton className="btn-ghost">{t("common.save")}</SubmitButton>
          </form>
        </section>
      )}

      {/* Feedback */}
      {feedback.length > 0 && (
        <section className="card mb-6">
          <h2 className="mb-2 text-lg font-extrabold text-green">{t("feedback.title")}</h2>
          <p className="mb-3 text-sm">⭐ {(feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1)} / 5 · {t("feedback.count", { n: feedback.length })}</p>
          <ul className="space-y-2 text-sm">
            {feedback.filter((f) => f.comment).map((f) => <li key={f.id} className="rounded-xl bg-cream p-3">“{f.comment}”</li>)}
          </ul>
        </section>
      )}
    </PortalShell>
  );
}
