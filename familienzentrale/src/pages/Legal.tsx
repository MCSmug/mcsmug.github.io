import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { hasOperator, OPERATOR } from '../lib/legal'

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-12">
      <Link to="/" className="mb-4 inline-flex min-h-12 items-center gap-2 text-muted">
        <ArrowLeft size={18} />
        Zurück zur App
      </Link>
      <h1 className="mb-4 font-display text-3xl font-bold">{title}</h1>
      <div className="flex flex-col gap-4 leading-relaxed [&_h2]:mt-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </main>
  )
}

function Operator() {
  if (!hasOperator) {
    return (
      <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-danger">
        Die Angaben zum Betreiber fehlen noch. Sie müssen eingetragen werden, bevor die App an andere
        weitergegeben wird.
      </p>
    )
  }
  return (
    <p>
      {OPERATOR.name}
      <br />
      {OPERATOR.street}
      <br />
      {OPERATOR.city}
      <br />
      E-Mail: <a href={`mailto:${OPERATOR.email}`} className="underline">{OPERATOR.email}</a>
    </p>
  )
}

export function Impressum() {
  return (
    <LegalPage title="Impressum">
      <h2>Verantwortlich für diese App</h2>
      <Operator />
      <p>
        Die Familienzentrale ist ein privates, nicht kommerzielles Angebot ohne Werbung und ohne Tracking.
      </p>
    </LegalPage>
  )
}

export function Datenschutz() {
  return (
    <LegalPage title="Datenschutz">
      <h2>Verantwortlicher</h2>
      <Operator />

      <h2>Welche Daten die App speichert</h2>
      <ul>
        <li>Ihre E-Mail-Adresse für die Anmeldung per Link.</li>
        <li>Den Namen Ihrer Familie sowie Namen, Rolle und Farbe der Familienmitglieder.</li>
        <li>Was Sie in die App eintragen: Termine, Aufgaben, Einkaufsliste und Nachrichten.</li>
      </ul>
      <p>
        Diese Daten sind nur für die angemeldeten Mitglieder derselben Familie sichtbar. Sie werden
        ausschließlich dafür verwendet, die Funktionen der App bereitzustellen (Art. 6 Abs. 1 lit. b DSGVO).
        Es gibt keine Werbung, keine Analyse-Werkzeuge und keine Weitergabe an Dritte zu anderen Zwecken.
      </p>

      <h2>Dienstleister</h2>
      <ul>
        <li>
          <strong>Supabase</strong> speichert die Daten und verschickt die Anmelde-E-Mails. Die Datenbank
          liegt in einem Rechenzentrum in der EU (Irland).
        </li>
        <li>
          <strong>Netlify</strong> liefert die App aus. Dabei verarbeitet Netlify technisch notwendige
          Verbindungsdaten wie die IP-Adresse; Netlify hat seinen Sitz in den USA.
        </li>
        <li>
          <strong>Anthropic</strong> wertet Fotos aus, wenn Sie die Funktion „Termine abfotografieren“
          nutzen. Nur dann wird das verkleinerte Foto an Anthropic in die USA übertragen. Die App selbst
          speichert das Foto nicht.
        </li>
      </ul>

      <h2>Benachrichtigungen und abonnierte Kalender</h2>
      <p>
        Wenn Sie Benachrichtigungen einschalten, speichert die App eine technische Adresse Ihres Geräts.
        Erinnerungen und Nachrichten werden verschlüsselt über den Benachrichtigungsdienst Ihres Browsers
        zugestellt (je nach Gerät Apple, Google oder Mozilla). Wenn Sie einen Kalender abonnieren, ruft der
        Server die angegebene Adresse regelmäßig ab und speichert die Termine in der Datenbank.
      </p>

      <h2>Speicherung im Browser</h2>
      <p>
        Damit Sie angemeldet bleiben, speichert die App Ihre Anmeldung und einzelne Einstellungen (zum
        Beispiel die gewählte Kalenderansicht) im Speicher Ihres Browsers. Es werden keine Cookies zu
        Werbe- oder Analysezwecken gesetzt.
      </p>

      <h2>Löschen</h2>
      <p>
        In den Einstellungen können Sie Ihr Konto oder die gesamte Familie mit allen Einträgen löschen.
        Die Daten werden dann sofort aus der Datenbank entfernt.
      </p>

      <h2>Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und
        Datenübertragbarkeit sowie das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
        Wenden Sie sich dafür an die oben genannte Adresse.
      </p>
    </LegalPage>
  )
}
