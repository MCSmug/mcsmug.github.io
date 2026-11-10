# Familienzentrale

Familien-App für Wandpanel und Handys: Kalender, Aufgaben, Einkaufsliste, Kindermodus,
Nachrichten, Push-Erinnerungen. Projektbriefing und Fahrplan stehen in [CLAUDE.md](CLAUDE.md).

**Stand:** Login per Magic Link, Familie und Mitglieder anlegen, Einkaufsliste mit
Realtime-Sync, Wochenkalender mit eigenen Terminen, Aufgaben mit Wiederholung, Kindermodus.

## Einrichtung

1. **Supabase-Projekt** in einer EU-Region anlegen (z. B. Frankfurt).
2. **Migrationen einspielen**: Dateien unter `supabase/migrations/` der Reihe nach im SQL-Editor ausführen
   oder mit der Supabase-CLI `supabase db push`.
3. **Auth konfigurieren** (Authentication → URL Configuration): Site-URL und Redirect-URLs
   auf die App-Adresse setzen (lokal `http://localhost:5173`, später die Netlify-URL).
4. **Optional**: Login per Code statt Link. Dafür muss in Supabase ein eigener
   Mail-Versand (SMTP) eingerichtet sein; erst dann lässt sich in den E-Mail-Vorlagen
   „Magic Link“ und „Confirm signup“ der Code `{{ .Token }}` ergänzen. Ohne das gibt es
   nur den Link.
5. `.env.example` nach `.env.local` kopieren und URL + Anon-Key eintragen.
6. `npm install`, dann `npm run dev`.

## Termine abfotografieren (optional)

Der Kamera-Knopf im Kalender schickt ein verkleinertes Foto an die Edge Function
`extract-events`, die die Termine mit der Claude-API ausliest. Das Foto wird nicht gespeichert.

1. API-Key unter https://console.anthropic.com anlegen (Guthaben nötig, ein Foto kostet wenige Cent).
2. Supabase → Edge Functions → Secrets: `ANTHROPIC_API_KEY` mit dem Key anlegen.
3. Supabase → Edge Functions → neue Funktion `extract-events` anlegen und den Inhalt von
   `supabase/functions/extract-events/index.ts` einfügen (oder `supabase functions deploy extract-events`).
4. In den Einstellungen der Funktion „Verify JWT with legacy secret“ ausschalten – die Funktion
   prüft die Anmeldung und die Familienzugehörigkeit selbst.

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
