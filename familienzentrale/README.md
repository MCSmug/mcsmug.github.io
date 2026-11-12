# Familienzentrale

Familien-App für Wandpanel und Handys: Kalender, Aufgaben, Einkaufsliste, Kindermodus,
Nachrichten, Push-Erinnerungen. Projektbriefing und Fahrplan stehen in [CLAUDE.md](CLAUDE.md).

**Stand:** Login per Magic Link, Familie und Mitglieder anlegen, Einkaufsliste mit
Realtime-Sync, Wochenkalender mit eigenen Terminen, Aufgaben mit Wiederholung, Kindermodus, Wandpanel unter `/panel`, Familien-Chat, Push-Nachrichten
und Erinnerungen, Kalender-Abos, Termine aus Fotos.

## Einrichtung

1. **Supabase-Projekt** in einer EU-Region anlegen.
2. **Migrationen einspielen**: Dateien unter `supabase/migrations/` der Reihe nach im SQL-Editor
   ausführen (oder `supabase db push`).
3. **Auth konfigurieren** (Authentication → URL Configuration): Site-URL und Redirect-URLs
   auf die App-Adresse setzen (lokal `http://localhost:5173`, später die Netlify-URL).
4. **Eigener Mail-Versand (SMTP)** unter Authentication → Emails: ohne ihn verschickt Supabase nur
   etwa zwei Anmelde-Mails pro Stunde, und die E-Mail-Vorlagen lassen sich nicht ändern. Erst mit
   SMTP kann in den Vorlagen „Magic Link“ und „Confirm signup“ der Code `{{ .Token }}` ergänzt
   werden (Login per Code statt Link).
5. `.env.example` nach `.env.local` kopieren und URL + Anon-Key eintragen.
6. `npm install`, dann `npm run dev`.

## Server-Funktionen (Edge Functions)

Alle drei mit `supabase functions deploy <name> --no-verify-jwt` einspielen; sie prüfen die Anmeldung selbst.

| Funktion | Zweck | Secrets |
|---|---|---|
| `extract-events` | Termine aus einem Foto lesen (Claude-API), Limit 30 Fotos pro Familie und Monat | `ANTHROPIC_API_KEY` |
| `notify` | Web Push: Chat-Nachrichten und fällige Erinnerungen | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| `sync-calendars` | Abonnierte Kalender (iCal) importieren | – |

- VAPID-Schlüssel erzeugen: `npx web-push generate-vapid-keys`; `VAPID_SUBJECT` ist die App-Adresse
  oder eine `mailto:`-Adresse.
- **Zeitgesteuerte Jobs**: `supabase/cron.sql` einmal ausführen (Projekt-Ref eintragen). Sendet fällige
  Erinnerungen jede Minute und aktualisiert Kalender alle 30 Minuten.
- Wurde das Projekt ohne „Automatically expose new tables“ angelegt, bekommt auch die Service-Rolle
  keine Standardrechte; die Migrationen vergeben die nötigen Rechte ausdrücklich.
- Die Foto-Erkennung schickt das verkleinerte Foto an Anthropic (USA); es wird nicht gespeichert.

## Betreiber-Angaben

Vor der Weitergabe an andere Familien Name, Anschrift und E-Mail in `src/lib/legal.ts` eintragen.
Sie erscheinen unter `/impressum` und `/datenschutz`.

## Zweites Elternteil einladen

Einstellungen → Mitglied hinzufügen → „Elternteil“ mit E-Mail-Adresse. Sobald sich jemand mit
dieser Adresse anmeldet, wird das Konto automatisch mit dem Mitglied verknüpft.

## Deploy (Netlify)

Im Netlify-Projekt „Base directory“ auf `familienzentrale` setzen; Build-Befehl und
Publish-Ordner kommen aus `netlify.toml`. Die beiden `VITE_…`-Variablen als
Environment Variables hinterlegen.

## Befehle

- `npm run dev` – Entwicklungsserver
- `npm run build` – Typprüfung + Produktions-Build (muss nach jeder Stufe fehlerfrei laufen)
- `npm run lint` – oxlint
