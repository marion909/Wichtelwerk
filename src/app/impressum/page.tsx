import { PublicShell } from "@/components/shell";
import { legal } from "@/lib/legal";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Impressum" };
export const dynamic = "force-dynamic";

export default async function Impressum() {
  const { t } = await getT();
  return (
    <PublicShell back="/impressum">
      <article className="card prose-sm mx-auto max-w-2xl space-y-3 text-sm">
        <h1 className="text-2xl font-extrabold text-green">{t("legal.imprint")}</h1>
        <p><b>Wichtelwerk</b><br />{legal.name}<br /><span className="whitespace-pre-line">{legal.address}</span></p>
        <p>E-Mail: <a className="underline" href={`mailto:${legal.email}`}>{legal.email}</a>{legal.phone && <><br />Tel.: {legal.phone}</>}</p>
        {legal.uid && <p>UID-Nr.: {legal.uid}</p>}
        <p>Website: https://{legal.domain}</p>
        <p className="text-xs text-muted">Information gemäß § 5 ECG, § 14 UGB, § 63 GewO bzw. § 5 DDG. Angaben zu Unternehmensgegenstand, Kammer- und Aufsichtsbehörde sind vom Betreiber zu ergänzen.</p>
      </article>
    </PublicShell>
  );
}
