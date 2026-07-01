# Germania — Mitgliederverzeichnis & Vereins-App

Eine mobile-first PWA (Vanilla TypeScript + Vite) für die Studentenverbindung
Germania (gegr. 1816). Backend: Supabase (PostgreSQL), mit Weg zu RDF/OWL + SPARQL.
Die gesamte Oberfläche ist auf **Deutsch**, im Couleur-Design **Schwarz-Gold-Rot**
mit eigenem Wappen.

Läuft auf alten wie neuen Smartphones (iPhone & Android) über den Browser — keine
App-Store-Installation nötig.

## Funktionen

- **Mitglieder** pflegen ihren eigenen Eintrag: Person, Foto, genaue Berufsbezeichnung
  (z. B. „Urologe“, „auf Immobilienrecht spezialisierter Anwalt“) mit optionaler
  Kategorie, sowie Ehepartner und Kinder — jeweils mit eigener Adresse und Geburtsdatum
  (Alter wird berechnet).
- **Suche**: nach Beruf, in der Nähe (per Standort + Umkreis) und über eine **Karte**
  aller Wohnorte. Treffer lassen sich **per E-Mail** kontaktieren oder als **CSV**
  (Adressen/E-Mails) exportieren — unter Beachtung der Privatsphäre-Einstellungen.
- **Termine**: weltweite Treffen, auch wiederkehrend (wöchentlich/monatlich), mit Zu-/
  Absage.
- **Stocherkahn**: Saison (zu Wasser / aus dem Wasser) wird vom Admin gesetzt; Mitglieder
  buchen **stundenweise** innerhalb des Dämmerungsfensters (Morgen- bis Abenddämmerung,
  automatisch aus Sonnenstand berechnet) und zahlen **1 € pro Stunde via Stripe**.
  Überschneidungen werden verhindert.
- **Rollen**: `member`, `officer` (Vorstand), `admin`. Admins verwalten Mitglieder und
  Rollen, Vorstand/Admin verwalten Berufskategorien, Termine und Buchungen. Durchgesetzt
  per Postgres Row Level Security.
- **Feedback**: Button in der Kopfzeile für Tester-Rückmeldungen.

## Prototyp auf GitHub Pages (ohne Backend)

Die App hat einen **Demo-Modus**: ohne Supabase-Zugangsdaten läuft alles im Browser mit
10 Beispiel-Mitgliedern — ideal zum Ausprobieren und Teilen. „Anna Berger“ ist Admin.

1. Repository auf GitHub anlegen und diesen Ordner nach `main` pushen.
2. Im Repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Der Workflow (`.github/workflows/deploy.yml`) baut und veröffentlicht bei jedem Push.
   Danach ist der Prototyp live unter `https://<dein-name>.github.io/<repo>/`.

Kein Supabase, keine Anmeldung, keine Schlüssel. Änderungen im Demo-Modus werden beim
Neuladen zurückgesetzt. Der Link ist öffentlich und kann an Tester weitergegeben werden.

> Hinweis: Die **Karte** benötigt Internet (Kartenkacheln werden online geladen), und die
> **Stocherkahn-Zahlung ist im Demo-Modus simuliert** (keine echte Abbuchung).

### Per Kommandozeile pushen

```bash
git add .
git commit -m "Germania"
git push
```

(Beim ersten Mal: `git init`, `git branch -M main`, `git remote add origin …`.)

## Lokal starten

Benötigt [Node.js](https://nodejs.org) (LTS). Dann im Projektordner:

```bash
npm install
npm run dev        # http://localhost:5173  (Demo-Modus, sofern keine .env gesetzt)
```

## Mit echten Daten (Supabase) live gehen

1. Supabase-Projekt anlegen; im SQL-Editor nacheinander ausführen:
   `schema.sql` → `supabase/storage.sql` → `supabase/seed.sql`.
2. Edge Functions deployen (`supabase/functions/`, siehe deren README): `geocode`,
   `send-email`, `create-checkout`, `stripe-webhook`.
3. `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` (Settings → API) als Build-Variablen
   im Pages-Workflow setzen — oder lokal in `.env` (Vorlage: `.env.example`).
4. In den Supabase-Auth-Einstellungen die Pages-URL zur Redirect-Liste hinzufügen und
   **Leaked-Password-Schutz / MFA** aktivieren.
5. Für die €1-Zahlung: Stripe-Konto, `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET`
   setzen (Details in `supabase/functions/README.md`).

Sobald Zugangsdaten vorhanden sind, schaltet die App automatisch vom Demo-Modus auf das
echte Supabase-Backend um (Anmeldung, Speichern, gemeinsame Daten, echte Zahlungen).

> **Sicherheit:** Niemals den `service_role`-Schlüssel oder echte Mitgliederdaten ins
> Repository committen. Der `anon`-Schlüssel ist für den Browser gedacht und durch RLS
> geschützt. Für ein privates Repo mit öffentlicher Pages-Seite ist GitHub Pro nötig.

## Projektstruktur

```
index.html               App-Hülle
src/main.ts              Einstieg, Router, Auth-Gate, Kopfzeile + Tab-Leiste
src/lib/
  supabase.ts            Supabase-Client (tolerant ohne Zugangsdaten)
  queries.ts             echte Datenzugriffe (Supabase)
  demo.ts                In-Memory-Demodaten (ohne Backend)
  api.ts                 Fassade: wählt echt vs. Demo
  suntimes.ts            Morgen-/Abenddämmerung (Sonnenstand)
  recurrence.ts          RRULE → nächste Termine
  crest.ts               Wappen (SVG)
  ui.ts                  kleine DOM-Helfer
src/screens/             auth, profile, directory (Suche/Karte), gatherings,
                         stocherkahn, admin, feedback
supabase/                schema.sql, storage.sql, seed.sql, functions/, config.toml
ontology.ttl             OWL-Ontologie + SPARQL (RDF-Phase)
DATA_MODEL.md            Datenmodell   ·   ARCHITECTURE.md  Systemdesign
```

## Technik

Vanilla TypeScript + Vite (kleines Bundle, läuft auf alten Browsern) · Supabase
(PostgreSQL + PostGIS, Auth, Storage, Edge Functions, Row Level Security) · MapLibre +
OpenStreetMap für die Karte · Stripe Checkout für die Stocherkahn-Gebühr · PWA
(installierbar, Offline-Hülle).
