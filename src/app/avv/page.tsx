import { PublicShell } from "@/components/shell";
import { avvSections } from "@/lib/avv";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "AV-Vertrag" };
export const dynamic = "force-dynamic";

export default async function AvvPage() {
  const { t } = await getT();
  const avv = avvSections();
  return (
    <PublicShell back="/avv">
      <article className="card mx-auto max-w-2xl space-y-4 text-sm leading-relaxed">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-extrabold text-green">{avv.title}</h1>
          <a href="/api/avv" className="btn-primary" download>{t("avv.download")}</a>
        </div>
        <p>{avv.intro}</p>
        {avv.sections.map((s) => (
          <section key={s.title}>
            <h2 className="font-extrabold">{s.title}</h2>
            <p>{s.body}</p>
          </section>
        ))}
        <p className="text-xs text-muted">Hinweis: Vorlage ohne Rechtsberatung. Bitte vor dem Einsatz juristisch prüfen.</p>
      </article>
    </PublicShell>
  );
}
