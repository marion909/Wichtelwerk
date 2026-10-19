# Wichtelwerk – Umsetzungsplan (MVP + V2)

Grundlage: [roadmap.md](roadmap.md). Dieser Plan hält fest, wie die Features umgesetzt wurden und was noch offen ist.

## Festlegungen

| Thema | Entscheidung |
| --- | --- |
| ORM | Prisma 6 (steht schon in CI/Deploy-Befehlen) |
| Auth | Auth.js (next-auth v5) mit Magic Link per SMTP; SSO per Microsoft Entra ID / Google |
| Ziehung | Randomisiertes Backtracking mit „most constrained first“ und Zeitlimit; bei Fehlschlag Diagnose der blockierenden Regel |
| Nachzügler | Einfügen in den bestehenden Zyklus (A→B wird A→N→B), keine komplette Neuziehung |
| Geheimhaltung | Admin-Pfade lesen `assignment` nie; `src/lib/data/assignments.ts` ist der einzige Zugriff, ein Test erzwingt das |
| Adressen / Gutscheine | AES-256-GCM auf Feldebene, Schlüssel aus `ENCRYPTION_KEY` |
| Vorjahres-Paare | `HMAC-SHA256(email, PSEUDONYM_PEPPER)`, keine Klartextdaten nach der Löschung |
| Rollen | `admin`, `location_admin`, `member` |
| Pakete | Free (25, ohne Regeln/Reveal-Modus), Team (100), Business (500, Standorte, Branding), Enterprise (SSO); Preise netto; Free ohne Kreditkarte |
| Jobs | Ein pg-boss-Schedule `tick` pro Minute statt Einzeljobs je Aktion; Erinnerungen über `reminder_log` genau einmal |
| i18n | `de` (Standard) und `en`, eigener schlanker Wörterbuch-Mechanismus mit Paritätstest |

## Phasen und Stand

| Phase | Inhalt | Stand |
| --- | --- | --- |
| 1 Fundament | Projekt, Prisma-Schema (inkl. V2), Auth, Mandantenfähigkeit, PM2/Nginx/CI-Dateien | ✅ |
| 2 Kern | Organisation, Aktionen, Einladungslink + CSV, Magic Link, Wunschzettel, Adresse, Dashboard | ✅ |
| 3 Ziehung & Kommunikation | Algorithmus + Tests, Worker, Erinnerungen, anonymer Chat, Reveal/Beamer | ✅ |
| 4 Zahlung & DSGVO | Stripe Checkout + Webhook, Paketlimits, Löschung, Impressum/Datenschutz, AV-Vertrag PDF | ✅ (Rechtstexte juristisch prüfen) |
| 5 V2 | Branding, mehrere Admins/Standort-Admins, SSO, Teams/Slack, Ratespiel, Geschenkideen, Gutscheine | ✅ |
| 6 Härtung | Unit-/Integrationstests, Lint, Build | siehe README |

## Bewusst offen / Annahmen

- **Gutscheine:** ohne Partnervertrag anbieterneutral – der Wichtel hinterlegt Code/Link, der Beschenkte sieht ihn nach dem Reveal. Eine Partner-API (Provision) wäre ein eigener Schritt.
- **Geschenkideen:** kuratierter Katalog (`npm run db:seed`), Links gehen auf eine Preisvergleichssuche. Affiliate-Links erst nach Vertrag.
- **SSO:** Microsoft/Google lassen sich ohne echte Zugangsdaten nicht end-to-end testen; Domain-Verifizierung per DNS-TXT und Entra-Tenant-Prüfung sind umgesetzt.
- **Magic-Link-Scanner:** Manche Firmen-Mailscanner rufen Links vorab ab und verbrauchen sie. Falls das auftritt, ist ein Code-Eingabe-Fallback der nächste Schritt.
- **Ein Nutzer = eine Firma.** Mehrfach-Mitgliedschaften sind nicht vorgesehen.
