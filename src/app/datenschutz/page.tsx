import { PublicShell } from "@/components/shell";
import { legal } from "@/lib/legal";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Datenschutzerklärung" };
export const dynamic = "force-dynamic";

export default async function Datenschutz() {
  const { t } = await getT();
  return (
    <PublicShell back="/datenschutz">
      <article className="card mx-auto max-w-2xl space-y-4 text-sm leading-relaxed">
        <h1 className="text-2xl font-extrabold text-green">{t("legal.privacy")}</h1>
        <section>
          <h2 className="font-extrabold">1. Verantwortlicher</h2>
          <p>{legal.name}, <span className="whitespace-pre-line">{legal.address}</span>, E-Mail: {legal.email}. Für die Wichtelaktion einer Firma ist die jeweilige Firma Verantwortliche, Wichtelwerk handelt als Auftragsverarbeiter (siehe <a className="underline" href="/avv">AV-Vertrag</a>).</p>
        </section>
        <section>
          <h2 className="font-extrabold">2. Welche Daten wir verarbeiten</h2>
          <ul className="list-disc pl-5">
            <li><b>Pflicht:</b> Name und E-Mail-Adresse (Anmeldung per Magic Link, Einladungen, Benachrichtigungen).</li>
            <li><b>Optional:</b> Abteilung, Standort, Wunschzettel (Text, Links, Interessen, No-Gos), Versandadresse.</li>
            <li><b>Wichtelphase:</b> Zuordnung (wer wen beschenkt), anonyme Chat-Nachrichten, optional Tipps beim „Wer war&apos;s?“-Spiel und Gutscheincodes.</li>
            <li><b>Technisch:</b> Server-Logs (IP-Adresse, Zeitpunkt) zur Fehlersuche und Absicherung, ein Sitzungs-Cookie für den Login und ein Cookie für die Spracheinstellung.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-extrabold">3. Zwecke und Rechtsgrundlagen</h2>
          <p>Durchführung der Wichtelaktion und Bereitstellung des Dienstes (Art. 6 Abs. 1 lit. b bzw. f DSGVO), Zahlungsabwicklung und Rechnungslegung (lit. b, c), IT-Sicherheit (lit. f).</p>
        </section>
        <section>
          <h2 className="font-extrabold">4. Geheimhaltung der Zuordnung</h2>
          <p>Die Zuordnung ist für Organisatoren nicht einsehbar; der Zugriff ist technisch auf den jeweils Beschenkenden beschränkt. Versandadressen werden verschlüsselt gespeichert und nur dem eigenen Wichtel angezeigt.</p>
        </section>
        <section>
          <h2 className="font-extrabold">5. Speicherdauer</h2>
          <p>Personenbezogene Aktionsdaten (Zuordnung, Chat, Wunschzettel, Adressen, Gutscheine) werden standardmäßig 30 Tage nach dem Reveal gelöscht; die Frist ist pro Aktion einstellbar. Danach bleiben nur pseudonymisierte Vorjahres-Paare (nicht umkehrbare Prüfwerte) für die Ausschlussregel erhalten. Rechnungsdaten werden gemäß den gesetzlichen Aufbewahrungsfristen gespeichert.</p>
        </section>
        <section>
          <h2 className="font-extrabold">6. Empfänger und Hosting</h2>
          <p>Hosting auf einem Server in der EU. Weitere Empfänger: E-Mail-Versand (SMTP-Dienstleister in der EU), Zahlungsabwicklung durch Stripe Payments Europe, Ltd. (nur bei kostenpflichtigen Paketen), sowie – falls von der Firma aktiviert – Slack oder Microsoft Teams (Benachrichtigungen ohne Zuordnungsdaten) und Microsoft/Google für den SSO-Login.</p>
        </section>
        <section>
          <h2 className="font-extrabold">7. Tracking</h2>
          <p>Wir setzen kein Tracking und keine Werbe-Cookies ein. Optional wird eine anonyme, cookiefreie Reichweitenmessung verwendet.</p>
        </section>
        <section>
          <h2 className="font-extrabold">8. Ihre Rechte</h2>
          <p>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Anfragen richten Sie an Ihre Firma bzw. an {legal.email}. Beschwerderecht bei der Datenschutzbehörde (Österreich: dsb.gv.at).</p>
        </section>
        <p className="text-xs text-muted">Hinweis: Dieser Text ist eine Vorlage und ersetzt keine Rechtsberatung. Bitte vor dem Live-Gang juristisch prüfen.</p>
      </article>
    </PublicShell>
  );
}
