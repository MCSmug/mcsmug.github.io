# Familienzentrale – Projektbriefing für Claude Code

Familien-App („Daily Maker“) für Wandpanel (Tablet quer) und Handys:
Kalender, Aufgaben, Einkaufsliste, Kindermodus, Nachrichten, Push-Erinnerungen.
Zuerst für die eigene Familie (2 Eltern, 2 Kinder im Kindergartenalter), später evtl. Veröffentlichung.

## Grundsätze
- UI-Sprache Deutsch, Code/Kommentare/Commits Englisch.
- Eine Codebasis: PWA, responsive. Wandpanel = Route `/panel` (1280×800 quer), Handy = Standard-Layout.
- Kinder können nicht lesen → Kindermodus nur mit großen Icons/Bildern, Touch-Ziele ≥ 64 px.
- Datenschutz: Supabase-Projekt in EU-Region, keine Tracker, keine Werbung.
- Kleine Schritte: jede Stufe muss lauffähig sein, bevor die nächste beginnt.

## Tech-Stack
- Vite + React + TypeScript
- Tailwind CSS
- Supabase: Postgres, Auth (Magic Link), Realtime, Edge Functions
- vite-plugin-pwa (Manifest, Service Worker, offline-fähige Shell)
- Web Push mit VAPID-Keys, Versand über Supabase Edge Function + pg_cron
- Kalender-Import: iCal-Abo-URLs (Google/iCloud „geheime Adresse“), geparst in einer Edge Function mit `ical.js`
- Deploy: Netlify (Frontend), Supabase (Backend)

## Datenmodell (Postgres)
- `families` (id, name, created_at)
- `members` (id, family_id, user_id nullable, name, color, role: 'parent' | 'child', avatar)
  - Kinder haben kein Login (user_id null), Eltern schon.
- `events` (id, family_id, member_id nullable, title, starts_at, ends_at, all_day, source: 'local' | 'ical', external_id)
- `calendar_feeds` (id, family_id, member_id, ical_url, last_synced_at)
- `tasks` (id, family_id, assignee_id, title, icon nullable, due_date, recurrence (RRULE) nullable, done_at nullable, is_kid_task bool)
- `shopping_items` (id, family_id, name, added_by, done bool, created_at)
- `messages` (id, family_id, author_id, text, send_push bool, created_at)
- `push_subscriptions` (id, member_id, endpoint, p256dh, auth)
- `reminders` (id, family_id, target_member_id nullable = alle, text, fire_at, sent_at nullable)

Row Level Security auf allen Tabellen: Zugriff nur für Mitglieder derselben `family_id`.
Das Wandpanel meldet sich mit einem eigenen Geräte-Login an (Eltern-Account oder Panel-Token).

## Design (aus dem Prototyp)
- Hintergrund `#F6F4EF`, Karten `#FFFFFF`, Text `#1C1B19`, gedämpft `#5F5B53`, Linien `#D6D1C7`
- Personenfarben: Papa `#2563EB`, Mama `#EA580C`, Kind 1 `#0F766E`, Kind 2 `#7C3AED`
  (helle Tönungen für Flächen: `#E3ECFD`, `#FDEBDD`, `#DDF1EE`, `#EDE5FD`)
- Schriften: Überschriften „Bricolage Grotesque“ 600/700, Text „Inter“ 400–600
- Ecken 16–24 px, keine Verläufe, keine Emojis, Icons als Linien-SVG (z. B. lucide-react)
- Erledigt = durchgestrichen + gefülltes Kästchen in Personenfarbe

### Wandpanel (`/panel`)
Linke dunkle Navigation: Heute · Kinder · Woche · Einkauf, unten Button „Nachricht an alle“.
- Heute: 3 Spalten – Termine heute, Aufgaben (alle), Einkauf (Vorschau)
- Kinder: je Kind eine farbige Karte mit 4 großen Bildkacheln + Sternezähler
- Woche: 7 Spalten Mo–So, Termin-Chips in Personenfarbe
- Einkauf: Eingabefeld + Liste in 3 Spalten
- Nachts gedimmt (22–6 Uhr), Bildschirm bleibt an (Wake Lock API)

### Handy
Untere Navigation: Heute · Aufgaben · Einkauf · Familie (Chat).
- Heute: Erinnerungs-Karte, Termine, „Meine Aufgaben“, Link zur Einkaufsliste
- Aufgaben: Filter-Chips nach Person
- Familie: Chat, Schalter „auch als Push senden“

## Fahrplan
1. Setup, Auth, Familie & Mitglieder anlegen, Einkaufsliste mit Realtime-Sync — **umgesetzt**
2. Aufgaben (inkl. Wiederholung) + Kindermodus — **umgesetzt**
3. Lokaler Kalender + iCal-Import + Heute-/Wochenansicht + Wandpanel
4. Web Push: Erinnerungen und Nachrichten
5. Feinschliff, Offline, dann Testfamilien

## Arbeitsweise
- Vor größeren Änderungen kurz den Plan nennen, dann umsetzen.
- Supabase-Migrationen als SQL-Dateien unter `supabase/migrations/`.
- Secrets nur in `.env.local`, nie committen. `.env.example` pflegen.
- Nach jeder Stufe: `npm run build` muss fehlerfrei laufen.

## Stand der Umsetzung (Notizen)
- Die App liegt im Unterordner `familienzentrale/` dieses Repos (der Rest ist eine statische GitHub-Pages-Seite).
- Abweichung vom Datenmodell: `members.invite_email` (nur Eltern). Wer sich mit dieser Adresse
  anmeldet, wird per RPC `claim_invites()` mit dem Mitglied verknüpft.
- Familie anlegen läuft über RPC `create_family()`; `members.user_id` ist vom Client nie schreibbar.
- RLS-Helfer: `is_family_member(family_id)`, `is_family_parent(family_id)` – in neuen Tabellen wiederverwenden.
- Schriften sind selbst gehostet (`@fontsource-variable/*`), keine Google-Fonts-Requests.
- Tailwind v4: Design-Tokens in `src/index.css` (`@theme`).
- Tab „Familie“ ist bis Stufe 4 ein Platzhalter.
- Aufgaben: Abweichung vom Datenmodell – zusätzliche Tabelle `task_completions` (ein Eintrag pro
  Aufgabe und Tag; Einträge von Kinderaufgaben sind die Sterne). `tasks.done_at` gilt nur für
  einmalige Aufgaben. Abhaken läuft ausschließlich über die RPC `set_task_done()`.
  Wiederholung: nur `FREQ=DAILY` und `FREQ=WEEKLY;BYDAY=…` (Logik in `src/lib/tasks.ts`).
- Kindermodus: Route `/kinder` ohne Navigation, Bilder aus `src/lib/taskIcons.ts`.
- Auf Wunsch vorgezogen (aus Stufe 3): lokaler Kalender. Die Startseite ist die Wochenansicht
  (Tab „Kalender“ statt „Heute“), Termine anlegen/ändern/löschen, Tabelle `events`.
  Der iCal-Import fehlt noch.
- Kalenderansichten: ab 768 px immer das Wochen-Zeitraster (`WeekGrid`); auf dem Handy umschaltbar
  Liste / 3 Tage / Woche (Auswahl in localStorage). In schmalen Spalten liegen gleichzeitige
  Termine versetzt übereinander statt nebeneinander.
- Wandpanel: Route `/panel` (`src/pages/panel/`), Unterseiten Heute, Kinder, Woche, Einkauf. Hält den
  Bildschirm an (Wake Lock), dimmt 22–6 Uhr und lädt sich um Mitternacht neu. Der Button
  „Nachricht an alle“ fehlt noch, bis es den Chat gibt (Stufe 4). Anmeldung mit einem Eltern-Konto.
- Bereitstellen kostet Netlify-Guthaben (jeder Upload startet dort einen Build): Änderungen
  sammeln und nur auf ausdrücklichen Wunsch hochladen.
- `events.ends_at` ist exklusiv; ganztägige Termine laufen von lokaler Mitternacht bis Mitternacht.
- Termine abfotografieren: Kamera-Knopf im Kalender → Edge Function `extract-events`
  (`supabase/functions/`, Claude-API mit strukturierter Ausgabe, Secret `ANTHROPIC_API_KEY`)
  → Vorschlagsliste zum Prüfen → Sammel-Insert in `events`. Das Foto wird nicht gespeichert,
  verlässt für die Erkennung aber die EU (bewusste Ausnahme vom Datenschutz-Grundsatz).
- Supabase lässt E-Mail-Vorlagen nur mit eigenem SMTP ändern; Login per Code geht erst dann.
- Deploy: Netlify-Projekt `familienzentrale-mdf4` (https://familienzentrale-mdf4.netlify.app),
  nicht mit GitHub verknüpft, wird manuell hochgeladen.
