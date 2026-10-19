import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isManager } from "@/lib/access";
import { PublicShell } from "@/components/shell";
import { getT } from "@/lib/i18n/server";
import { PLANS, formatMoney } from "@/lib/plans";
import type { TKey } from "@/lib/i18n";

const FEATURES: { icon: string; title: TKey; body: TKey }[] = [
  { icon: "🎲", title: "landing.f1.title", body: "landing.f1.body" },
  { icon: "🔒", title: "landing.f2.title", body: "landing.f2.body" },
  { icon: "💬", title: "landing.f3.title", body: "landing.f3.body" },
  { icon: "📺", title: "landing.f4.title", body: "landing.f4.body" },
  { icon: "🌍", title: "landing.f5.title", body: "landing.f5.body" },
  { icon: "🇪🇺", title: "landing.f6.title", body: "landing.f6.body" },
];

export default async function Landing() {
  const user = await getCurrentUser();
  if (user?.organizationId) redirect(isManager(user.role) ? "/admin" : "/app");
  const { t, locale } = await getT();
  const intl = locale === "de" ? "de-AT" : "en-GB";

  return (
    <PublicShell>
      <section className="py-10 text-center sm:py-16">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight text-green sm:text-6xl">{t("landing.title")}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">{t("landing.subtitle")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="btn-accent !px-6 !py-3 text-base">{t("landing.cta")}</Link>
          <a href="#preise" className="btn-ghost !px-6 !py-3 text-base">{t("landing.pricing")}</a>
        </div>
        <p className="mt-4 text-xs text-muted">{t("landing.cta.hint")}</p>
      </section>

      <section className="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <p className="text-3xl" aria-hidden>{f.icon}</p>
            <h2 className="mt-2 font-extrabold text-green">{t(f.title)}</h2>
            <p className="mt-1 text-sm text-muted">{t(f.body)}</p>
          </div>
        ))}
      </section>

      <section className="py-8">
        <h2 className="mb-6 text-center text-2xl font-extrabold text-green">{t("landing.steps")}</h2>
        <ol className="grid gap-4 sm:grid-cols-4">
          {(["landing.s1", "landing.s2", "landing.s3", "landing.s4"] as const).map((k, i) => (
            <li key={k} className="card text-center">
              <p className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-green font-extrabold text-cream">{i + 1}</p>
              <p className="text-sm font-bold">{t(k)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="preise" className="py-8">
        <h2 className="mb-2 text-center text-2xl font-extrabold text-green">{t("landing.pricing")}</h2>
        <p className="mb-6 text-center text-sm text-muted">{t("landing.pricing.hint")}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["free", "team", "business", "enterprise"] as const).map((p) => {
            const plan = PLANS[p];
            return (
              <div key={p} className={`card ${p === "team" ? "border-coral ring-2 ring-coral/30" : ""}`}>
                <h3 className="text-lg font-extrabold text-green">{t(`plan.${p}`)}</h3>
                <p className="my-2 text-3xl font-extrabold">
                  {plan.priceCents === null ? t("plan.onRequest") : formatMoney(plan.priceCents, "EUR", intl)}
                </p>
                <p className="mb-3 text-xs text-muted">{plan.priceCents ? t("plan.perCampaignNet") : t("plan.always")}</p>
                <p className="mb-2 text-sm font-bold">{p === "enterprise" ? t("plan.over500") : t("plan.upTo", { n: plan.maxParticipants })}</p>
                <ul className="space-y-1 text-sm text-muted">
                  {(t(`plan.${p}.features`)).split("|").map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </PublicShell>
  );
}
