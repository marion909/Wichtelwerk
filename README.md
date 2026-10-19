# Wichtelwerk

Wichtel-App (PWA) für Firmen: HR oder Office-Management setzen in 10 Minuten eine Wichtelaktion auf. Mitarbeitende brauchen weder App noch Passwort (Magic Link). Konzept: [roadmap.md](roadmap.md), Umsetzung: [PLAN.md](PLAN.md).

**Stack:** Next.js (App Router) · Tailwind · PostgreSQL + Prisma · Auth.js (Magic Link, optional Microsoft Entra ID / Google) · pg-boss (Worker) · Stripe Checkout · PM2 + Nginx (aaPanel).

## Funktionsumfang

| Bereich | MVP | V2 |
| --- | --- | --- |
| Aktion | Budget, Termine, Ort/Versand, mehrere Aktionen pro Firma | Standort-Scope je Aktion |
| Teilnehmer | Einladungslink, CSV-Import, Magic Link | SSO (Microsoft 365 / Google) mit DNS-verifizierter Domain |
| Ziehung | Einzelzyklus, Regeln (Abteilung, Paare, Vorjahr), geheim auch für Admins, Nachzügler werden eingefügt, Diagnose bei Unlösbarkeit | |
| Wunschzettel | Text, Links, Tags, No-Gos | Geschenkideen passend zu Tags und Budget |
| Kommunikation | Anonymer Chat, E-Mail-Erinnerungen | Teams-/Slack-Webhooks |
| Remote | Versandadresse (verschlüsselt, nur für den eigenen Wichtel) | Digitale Gutscheine |
| Event | Reveal-Modus mit Beamer-Ansicht | „Wer war's?“-Ratespiel |
| Admin | Dashboard (Status, fehlende Wunschzettel, Nachzügler) | Branding (Logo, Farbe), mehrere Admins, Standort-Admins |
| Abrechnung | Stripe Checkout pro Aktion, Rechnung mit UID | |
| Datenschutz | Automatische Löschung, AV-Vertrag als PDF, Impressum, Datenschutz | |
| Sprache | Deutsch + Englisch | |

## Lokale Entwicklung

Voraussetzung: Node.js 22, PostgreSQL 16/17.

```bash
npm ci
cp .env.example .env        # DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY, PSEUDONYM_PEPPER setzen
npx prisma migrate dev
npm run db:seed             # Katalog für Geschenkideen
npm run dev                 # Web auf :4000
npm run worker:dev          # Worker (Ziehung, Erinnerungen, Löschfristen)
```

Ohne `SMTP_HOST` werden Mails (inkl. Magic Link) in der Konsole ausgegeben. Ohne `STRIPE_SECRET_KEY` ist der Kauf deaktiviert.

Tests: `npm test` (Unit-Tests). Der Datenbank-Integrationstest läuft mit `TEST_DATABASE_URL=postgresql://… npm test` gegen eine migrierte Test-DB.

## Server-Setup (aaPanel, PM2, PostgreSQL)

1. PostgreSQL: `CREATE USER wichtel WITH PASSWORD '…'; CREATE DATABASE wichtel OWNER wichtel;`, `listen_addresses = 'localhost'`.
2. `.env` aus `.env.example` auf dem Server anlegen (steht in `.gitignore`, wird beim Pull nicht überschrieben). Schlüssel erzeugen: `openssl rand -base64 32` für `AUTH_SECRET`, `ENCRYPTION_KEY` und `PSEUDONYM_PEPPER`.
3. aaPanel: Repo als Node-Projekt mit Git-Quelle `main` verbinden, Build-Befehl `npm ci && npx prisma migrate deploy && npm run build` (baut Web **und** den Worker nach `dist/worker.js`).
4. Start: `pm2 start ecosystem.config.js && pm2 save && pm2 startup`; nach jedem Deploy `pm2 reload ecosystem.config.js`.
5. Website `wichtelwerk.neuhauser.cloud` mit Reverse Proxy auf `127.0.0.1:4000` und Let's-Encrypt-SSL anlegen (Vorlage: [nginx.conf.example](nginx.conf.example)).
6. Stripe-Webhook auf `https://wichtelwerk.neuhauser.cloud/api/stripe/webhook` (Event `checkout.session.completed`) einrichten.
7. Backups: nächtlicher `pg_dump` per Cron (14 Tage), zusätzlich Off-site-Kopie. Der Ordner `UPLOAD_DIR` (Firmenlogos) gehört ebenfalls ins Backup.
8. Einmalig `npm run db:seed` für die Geschenkideen.

Health-Check: `GET /api/health`.

## Betrieb

- **Pakete manuell setzen** (z. B. Enterprise nach Vertragsabschluss): `npm run org:plan -- <Firmen-ID|Name> enterprise`.
- **SSO** wird pro Firma im Paket Enterprise aktiviert: Domain eintragen, DNS-TXT `_wichtelwerk.<domain>` mit dem angezeigten Token setzen, prüfen. Für Microsoft muss zusätzlich die Entra-Tenant-ID hinterlegt werden; auf dem Server sind `AUTH_MICROSOFT_ENTRA_ID_*` bzw. `AUTH_GOOGLE_*` zu setzen.
- **Worker:** läuft jede Minute (pg-boss-Schedule) und erledigt Einladungsmails, Ziehungen zum Stichtag, Erinnerungen, automatischen Reveal und Löschfristen. Es darf genau eine Instanz geben.
- **Rechtstexte:** Impressum, Datenschutzerklärung und AV-Vertrag sind Vorlagen und vor dem Live-Gang juristisch zu prüfen. Die Betreiberdaten kommen aus den `LEGAL_*`-Variablen.

## Architektur-Notizen

- **Geheime Zuordnung:** Nur [src/lib/data/assignments.ts](src/lib/data/assignments.ts) greift auf `assignment` und `message` zu. Admin-Seiten bekommen höchstens Zähler und Machbarkeitsprüfungen. Ein Test (`assignments.guard.test.ts`) stellt das sicher.
- **Ziehung:** [src/lib/draw.ts](src/lib/draw.ts), randomisiertes Backtracking mit „most constrained first“; bei Unlösbarkeit liefert `diagnose` die blockierende Regel.
- **DSGVO:** Versandadressen und Gutscheincodes AES-256-GCM, Vorjahres-Paare als HMAC, Löschung 30 Tage (einstellbar) nach dem Reveal.
- **Mandanten:** Jede Abfrage ist über `organizationId` eingegrenzt; Standort-Admins sehen nur Aktionen ihrer Standorte.
- Ein Nutzer gehört genau einer Firma (E-Mail ist global eindeutig).
