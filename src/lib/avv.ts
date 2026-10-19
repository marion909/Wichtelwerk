import { legal } from "@/lib/legal";

export interface AvvSection {
  title: string;
  body: string;
}

/** Inhalt des Auftragsverarbeitungsvertrags (Art. 28 DSGVO), gemeinsam für HTML und PDF. */
export function avvSections(): { title: string; intro: string; sections: AvvSection[] } {
  return {
    title: "Auftragsverarbeitungsvertrag (AV-Vertrag) gemäß Art. 28 DSGVO",
    intro: `zwischen der Firma, die Wichtelwerk nutzt (Verantwortlicher, „Auftraggeber“), und ${legal.name}, ${legal.address} (Auftragsverarbeiter, „Auftragnehmer“), Betreiber von Wichtelwerk (${legal.domain}).`,
    sections: [
      { title: "1. Gegenstand und Dauer", body: "Der Auftragnehmer verarbeitet personenbezogene Daten im Auftrag des Auftraggebers zur Durchführung betrieblicher Wichtelaktionen über die Plattform Wichtelwerk. Der Vertrag gilt für die Dauer der Nutzung und endet mit der Löschung der Aktionsdaten." },
      { title: "2. Art und Zweck der Verarbeitung", body: "Anlegen und Verwalten von Aktionen, Einladung und Anmeldung von Teilnehmern, Wunschzettel, geheime Zuordnung (Ziehung), anonymer Chat, Erinnerungen und Benachrichtigungen, Reveal, Abrechnung sowie fristgerechte Löschung." },
      { title: "3. Kategorien betroffener Personen und Daten", body: "Betroffene: Mitarbeitende und sonstige vom Auftraggeber eingeladene Teilnehmende. Daten: Name, E-Mail-Adresse, optional Abteilung, Standort, Wunschzettelinhalte, Versandadresse, Chat-Nachrichten, Zuordnungsdaten, Gutscheincodes, Nutzungs- und Protokolldaten. Besondere Kategorien von Daten werden nicht verlangt; Teilnehmende werden angehalten, solche nicht einzugeben." },
      { title: "4. Weisungsgebundenheit", body: "Der Auftragnehmer verarbeitet Daten nur auf dokumentierte Weisung des Auftraggebers, die sich aus diesem Vertrag und der Konfiguration der Aktionen in der Plattform ergibt. Er informiert den Auftraggeber, wenn er eine Weisung für rechtswidrig hält." },
      { title: "5. Vertraulichkeit", body: "Zur Verarbeitung befugte Personen sind zur Vertraulichkeit verpflichtet. Die Zuordnung der Wichtelpaare ist auch für Administratoren des Auftraggebers technisch nicht einsehbar." },
      { title: "6. Technische und organisatorische Maßnahmen (Art. 32 DSGVO)", body: "Hosting in der EU; Transportverschlüsselung (TLS); Verschlüsselung von Versandadressen und Gutscheincodes in der Datenbank (AES-256-GCM); passwortloser Login per Magic Link; mandantenfähige Datentrennung; Rollen- und Rechtekonzept; Datenbank nur lokal erreichbar; regelmäßige Backups (14 Tage Aufbewahrung, zusätzlich Off-site-Kopie); Protokollierung und Überwachung; automatische Löschfristen." },
      { title: "7. Unterauftragsverarbeiter", body: "Der Auftraggeber stimmt dem Einsatz folgender Kategorien zu: Rechenzentrum/Hosting (EU), E-Mail-Versand (EU), Zahlungsabwicklung (Stripe Payments Europe, Ltd., nur bei kostenpflichtigen Paketen). Über Änderungen wird der Auftraggeber rechtzeitig informiert und kann aus wichtigem Grund widersprechen." },
      { title: "8. Unterstützung bei Betroffenenrechten und Pflichten", body: "Der Auftragnehmer unterstützt den Auftraggeber im Rahmen des Zumutbaren bei Anfragen betroffener Personen (Art. 12–22 DSGVO) sowie bei Pflichten nach Art. 32–36 DSGVO." },
      { title: "9. Meldung von Datenschutzverletzungen", body: "Der Auftragnehmer meldet dem Auftraggeber Verletzungen des Schutzes personenbezogener Daten unverzüglich nach Bekanntwerden." },
      { title: "10. Löschung und Rückgabe", body: "Aktionsdaten (Zuordnung, Chat, Wunschzettel, Adressen, Gutscheine) werden nach der eingestellten Frist (Standard: 30 Tage nach dem Reveal) gelöscht. Es verbleiben nur pseudonymisierte Vorjahres-Paare (nicht umkehrbare Prüfwerte). Auf Verlangen werden Daten früher gelöscht." },
      { title: "11. Nachweise und Kontrollen", body: "Der Auftragnehmer stellt dem Auftraggeber die erforderlichen Informationen zum Nachweis der Einhaltung dieses Vertrags zur Verfügung und ermöglicht Überprüfungen im angemessenen Rahmen." },
      { title: "12. Schlussbestimmungen", body: "Es gilt österreichisches Recht. Änderungen bedürfen der Textform. Ein individueller AV-Vertrag ist im Enterprise-Paket möglich." },
    ],
  };
}
