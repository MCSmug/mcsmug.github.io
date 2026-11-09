# Familienzentrale

Familien-App für Wandpanel und Handys: Kalender, Aufgaben, Einkaufsliste, Kindermodus,
Nachrichten, Push-Erinnerungen. Projektbriefing und Fahrplan stehen in [CLAUDE.md](CLAUDE.md).

**Stand: Stufe 1** – Login per Magic Link, Familie und Mitglieder anlegen, Einkaufsliste mit
Realtime-Sync.

## Einrichtung

1. **Supabase-Projekt** in einer EU-Region anlegen (z. B. Frankfurt).
2. **Migration einspielen**: Inhalt von `supabase/migrations/*.sql` im SQL-Editor ausführen
   oder mit der Supabase-CLI `supabase db push`.
3. **Auth konfigurieren** (Authentication → URL Configuration): Site-URL und Redirect-URLs
   auf die App-Adresse setzen (lokal `http://localhost:5173`, später die Netlify-URL).
4. **Optional, empfohlen für installierte PWA und Wandpanel**: In der E-Mail-Vorlage
   „Magic Link“ zusätzlich den Code `{{ .Token }}` ausgeben. Dann kann man sich auch per
   Code anmelden, wenn der Link im falschen Browser aufgeht.
5. `.env.example` nach `.env.local` kopieren und URL + Anon-Key eintragen.
6. `npm install`, dann `npm run dev`.

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
