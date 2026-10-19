# Wichtelwerk – Konzept

Stand: 19.10.2026 · Mario Neuhauser

**Name:** Wichtelwerk · **Domain:** [wichtelwerk.neuhauser.cloud](https://wichtelwerk.neuhauser.cloud)

## Vision & Zielgruppe

Eine Web-App (PWA), mit der HR oder Office-Management in 10 Minuten eine Wichtelaktion für die ganze Firma aufsetzt. Mitarbeiter brauchen keine App-Installation und keinen Account mit Passwort.

- **Zielgruppe:** KMU mit 20–500 Mitarbeitern im DACH-Raum, zuerst Österreich und Deutschland.
- **Käufer:** HR, Office-Management, Betriebsrat, Teamleads.
- **Nutzer:** alle Mitarbeiter, auch remote und an mehreren Standorten.
- **Abgrenzung:** Bestehende Wichtel-Tools zielen auf Familie und Freunde. Wichtelwerk bietet dagegen Admin-Steuerung, Ausschlussregeln nach Abteilung, DSGVO-Konformität, EU-Hosting und eine Rechnung für die Buchhaltung.

## Rollen & Ablauf einer Wichtelaktion

Es gibt drei Rollen: **Organisator** (legt die Aktion an und verwaltet sie), **Teilnehmer** (wünscht, beschenkt, wird beschenkt) und optional einen **Co-Organisator** pro Standort.

1. **Aktion anlegen:** Name, Budget, Anmeldeschluss, Ziehungsdatum, Übergabetermin und Ort oder Versand.
2. **Teilnehmer einladen:** per Einladungslink, CSV-Import oder später SSO. Optional mit Abteilung und Standort.
3. **Anmeldung:** Teilnehmer bestätigen per Magic Link, füllen einen Wunschzettel aus und geben bei Bedarf eine Versandadresse an.
4. **Ziehung:** automatisch zum Stichtag oder manuell. Ausschlussregeln werden dabei berücksichtigt, und die Zuordnung bleibt auch für den Organisator geheim.
5. **Wichtelphase:** Jeder sieht, wen er beschenkt, samt Wunschzettel. Rückfragen laufen über einen anonymen Chat, dazu kommen Erinnerungen per E-Mail.
6. **Übergabe & Reveal:** Aufdecken am Event-Tag, optional als Live-Ansicht für den Beamer bei der Weihnachtsfeier.
7. **Abschluss:** Feedback einholen, Zuordnung als Vorjahres-Paar speichern (für die Ausschlussregel) und personenbezogene Daten nach X Tagen löschen.

## Feature-Liste

Das MVP deckt eine komplette Aktion für eine Firma ab. Alles mit Integrationen oder Zahlungsflüssen über das Nötigste hinaus kommt nach der ersten Saison.

| Bereich | Feature | Phase |
| --- | --- | --- |
| Aktion | Aktion anlegen: Budget, Stichtage, Ort/Versand, Beschreibung | MVP |
| Aktion | Mehrere Aktionen pro Firma (z. B. pro Standort oder Team) | MVP |
| Teilnehmer | Einladungslink + CSV-Import (Name, E-Mail, Abteilung, Standort) | MVP |
| Teilnehmer | Login per Magic Link, kein Passwort | MVP |
| Teilnehmer | SSO mit Microsoft 365 / Google Workspace | V2 |
| Ziehung | Zufallsziehung als Zyklus (keiner zieht sich selbst) | MVP |
| Ziehung | Ausschlussregeln: gleiche Abteilung, Paare manuell, Vorjahres-Paar | MVP |
| Ziehung | Ziehung geheim, auch für den Admin; Neuziehung bei Nachzüglern | MVP |
| Wunschzettel | Freitext, Links, Interessen-Tags, „No-Gos“ (z. B. kein Alkohol) | MVP |
| Wunschzettel | Geschenkideen-Vorschläge passend zu Tags und Budget | V2 |
| Kommunikation | Anonymer Chat zwischen Wichtel und Beschenktem | MVP |
| Kommunikation | E-Mail-Erinnerungen (Anmeldeschluss, Ziehung, Übergabe) | MVP |
| Kommunikation | Teams-/Slack-Benachrichtigungen | V2 |
| Remote | Versandadresse, nur für den eigenen Wichtel sichtbar | MVP |
| Remote | Digitale Gutscheine statt physischer Geschenke | V2 |
| Event | Reveal-Modus mit Live-Ansicht für Beamer | MVP |
| Event | „Wer war's?“-Ratespiel vor dem Reveal | V2 |
| Admin | Dashboard: Anmeldestatus, fehlende Wunschzettel, Nachzügler | MVP |
| Admin | Branding: Firmenlogo und Farben | V2 |
| Admin | Mehrere Admins, Rollen pro Standort | V2 |
| Abrechnung | Kauf pro Aktion mit Stripe, Rechnung mit UID | MVP |
| Datenschutz | Automatische Löschung nach Aktion, AV-Vertrag als PDF | MVP |
| Sprache | Deutsch + Englisch | MVP |

## Datenmodell

Das Modell hat acht Tabellen. Jede Zeile hängt über `organization_id` an einer Firma, so bleibt das System von Anfang an mandantenfähig.

| Tabelle | Wichtige Felder | Beziehung |
| --- | --- | --- |
| organization | id, name, uid_nummer, logo_url, plan, created_at | hat viele users, campaigns |
| user | id, organization_id, email, name, department, location, role (admin/member) | gehört zu organization |
| campaign | id, organization_id, title, budget_cents, currency, signup_deadline, draw_at, reveal_at, mode (vor Ort/Versand/gemischt), status (draft/open/drawn/revealed/closed), delete_after | hat viele participants |
| participant | id, campaign_id, user_id, status (invited/joined/declined), shipping_address (verschlüsselt) | verbindet user und campaign |
| wishlist | id, participant_id, text, links[], tags[], no_gos | 1:1 zu participant |
| exclusion_rule | id, campaign_id, type (same_department/pair/previous_year), participant_a, participant_b | gehört zu campaign |
| assignment | id, campaign_id, giver_id, receiver_id, revealed | Ergebnis der Ziehung |
| message | id, assignment_id, sender_role (giver/receiver), body, created_at | gehört zu assignment |

Die Ziehung läuft als Backtracking-Suche nach einem Zyklus, der alle Ausschlussregeln erfüllt. Gibt es keine Lösung, zeigt die App dem Admin, welche Regel blockiert. Admins haben keinen Lesezugriff auf `assignment`, das ist auf API-Ebene erzwungen.

## Tech-Stack, Hosting & DSGVO

Ein Monolith in TypeScript auf dem eigenen Server: schnell gebaut, günstig im Betrieb, keine Microservices.

| Schicht | Wahl | Begründung |
| --- | --- | --- |
| Frontend | Next.js (App Router) als PWA, Tailwind | Eine Codebasis für Web und Handy, keine Store-Freigabe nötig |
| Backend | Next.js Route Handlers / Server Actions | Kein separater API-Server im MVP |
| Datenbank | PostgreSQL + Prisma oder Drizzle | Relationales Modell passt, Migrationen inklusive |
| Auth | Auth.js mit Magic Link, später Entra ID / Google | Kein Passwort-Handling |
| E-Mail | SMTP über eigenen Mailserver oder Brevo/Postmark (EU) | Zustellbarkeit der Magic Links ist kritisch |
| Jobs | pg-boss in eigenem PM2-Worker-Prozess | Läuft in derselben Postgres |
| Zahlung | Stripe Checkout (Einmalzahlung pro Aktion) | Rechnungen mit UID automatisch |
| Hosting | Eigener Server: Nginx (aaPanel) + PM2 + PostgreSQL | Datenstandort EU als Verkaufsargument |

**DSGVO-Punkte:**

- Datensparsamkeit: Pflicht sind nur Name und E-Mail, Abteilung und Adresse sind optional.
- Versandadressen werden in der Datenbank verschlüsselt und nur dem eigenen Wichtel angezeigt.
- Löschfrist pro Aktion, Standard 30 Tage nach dem Reveal; danach bleiben nur Vorjahres-Paare (pseudonymisiert) zurück.
- AV-Vertrag, Datenschutzerklärung und Impressum zum Download; kein Tracking außer anonymer Statistik (z. B. Plausible).

## Server-Setup: PostgreSQL + PM2

Next.js läuft als Production-Build unter PM2 hinter Nginx. PostgreSQL läuft auf demselben Server und ist nur lokal erreichbar.

- **Nginx (aaPanel):** Reverse Proxy von `wichtelwerk.neuhauser.cloud` auf `127.0.0.1:4000`, SSL über Let's Encrypt.
- **PM2 `wichtel-web`:** `next start`, Cluster-Modus mit 2 Instanzen, Zero-Downtime per `pm2 reload`.
- **PM2 `wichtel-worker`:** genau 1 Instanz für pg-boss-Jobs (Ziehung, Erinnerungen, Löschfristen), damit kein Job doppelt läuft.
- **PostgreSQL 16/17:** Datenbank `wichtel` mit eigenem User, lokal über `localhost:5432` erreichbar, Port nicht nach außen offen (`listen_addresses = 'localhost'`).
- **Backups:** nächtlicher `pg_dump` per Cron, 14 Tage aufbewahrt, zusätzlich eine Kopie off-site.

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'wichtel-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4000',
      exec_mode: 'cluster',
      instances: 2,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M'
    },
    {
      name: 'wichtel-worker',
      script: 'dist/worker.js',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' }
    }
  ]
};
```

**Erstinstallation:**

1. PostgreSQL: `CREATE USER wichtel WITH PASSWORD '…'; CREATE DATABASE wichtel OWNER wichtel;`
2. `.env` mit `DATABASE_URL=postgresql://wichtel:…@localhost:5432/wichtel`, SMTP- und Stripe-Keys anlegen.
3. `npm ci && npx prisma migrate deploy && npm run build`
4. `pm2 start ecosystem.config.js && pm2 save && pm2 startup`
5. In aaPanel die Website `wichtelwerk.neuhauser.cloud` mit Reverse Proxy auf Port 4000 und SSL anlegen.

**Update-Deploy:** übernimmt aaPanel automatisch bei jedem Push auf `main`, ohne eigenes Deploy-Skript.

Connection-Pool begrenzen: 2 Web-Instanzen × 10 Verbindungen + Worker bleiben deutlich unter dem Postgres-Standard von 100 Verbindungen.

## GitHub-Repo & Autodeploy

Ein einziges Repo enthält App und Server-Dateien. Alles, was der Server zum Bauen und Starten braucht, liegt im Repo-Root. aaPanel holt sich bei einem Push auf `main` den neuen Stand und deployt selbst.

```text
wichtelwerk/
├── .github/workflows/ci.yml       # Lint + Build-Check bei Push/PR
├── ecosystem.config.js            # PM2: wichtel-web + wichtel-worker
├── .env.example                   # Vorlage, echte .env nur auf dem Server
├── nginx.conf.example             # Reverse-Proxy-Vorlage für aaPanel
├── package.json                   # Scripts: build, start, worker, migrate
├── next.config.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/                       # Next.js App Router (Seiten + API)
│   ├── lib/                       # DB, Auth, Mail, Ziehungs-Algorithmus
│   └── worker/                    # pg-boss-Jobs → Build nach dist/worker.js
└── public/
```

**.github/workflows/ci.yml** (nur Prüfung, das Deployment macht aaPanel):

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm run build
```

**Einmalig in aaPanel:**

1. Repo in aaPanel als Node-Projekt mit Git-Quelle `main` verbinden.
2. `.env` aus `.env.example` auf dem Server anlegen. Sie steht in `.gitignore` und wird beim Pull nicht überschrieben.
3. Build-Befehl in aaPanel: `npm ci && npx prisma migrate deploy && npm run build`
4. Start über `ecosystem.config.js`, damit Web und Worker als getrennte PM2-Prozesse laufen.

## Monetarisierung

Bezahlt wird pro Aktion, nicht im Abo. Wichteln findet einmal im Jahr statt, und HR kauft lieber eine Pauschale.

| Paket | Teilnehmer | Preis (Vorschlag) | Enthalten |
| --- | --- | --- | --- |
| Free | bis 25 | 0 € | Alle MVP-Kernfunktionen, Hinweis „powered by Wichtelwerk“ |
| Team | bis 100 | 49 € pro Aktion | Ausschlussregeln, Reveal-Modus, Rechnung |
| Business | bis 500 | 149 € pro Aktion | Mehrere Standorte, Branding, Priority-Support |
| Enterprise | über 500 | auf Anfrage | SSO, AV-Vertrag individuell |

Zusatzeinnahmen sind über Affiliate-Links in Geschenkideen (V2) und Provisionen auf Gutscheine (V2) möglich. Werbung ist im Firmenkontext eher schädlich und deshalb nicht vorgesehen.

Offene Frage: Preise netto ausweisen? Free-Paket ohne Kreditkarte?

## Roadmap bis Mitte November

Mit vier Wochen Entwicklung steht das MVP am 16. November. So bleiben drei Wochen, um Firmen zu gewinnen, bevor die Wichtel-Saison Anfang Dezember startet.

| Phase | Zeitraum | Inhalt |
| --- | --- | --- |
| Konzept und UI-Design | 20.10. – 26.10. | Screens, Datenmodell final, Repo + aaPanel-Projekt anlegen |
| Kern | 27.10. – 05.11. | Organisationen, Aktionen, Einladungen, Magic Link, Wunschzettel |
| Ziehung, Chat, Mails | 03.11. – 10.11. | Ziehungs-Algorithmus mit Ausschlussregeln, anonymer Chat, Erinnerungen |
| Zahlung, DSGVO, Tests | 09.11. – 15.11. | Stripe Checkout, Löschfristen, AV-Vertrag, End-to-End-Tests |
| **MVP live** | **16.11.** | Launch auf wichtelwerk.neuhauser.cloud |
| Vertrieb und Support | 17.11. – 06.12. | Firmen ansprechen, Feedback einarbeiten |
| Wichtel-Saison | 07.12. – 23.12. | Betrieb, Reveal-Events, Support |

Die Phasen Kern und Ziehung überlappen bewusst. Wird es knapp, wandern Chat und Reveal-Modus in ein Update Ende November.
