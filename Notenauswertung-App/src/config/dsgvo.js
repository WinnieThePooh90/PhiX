/**
 * Datenschutzhinweise für selbst betriebene PhiX-Instanzen (Desktop oder eigener Server).
 * Kein zentraler Online-Dienst — Art.-13/14-Pflichten gegenüber Schülern/Eltern obliegen dem Betreiber.
 */
export const DSGVO_SECTIONS = [
  {
    id: 'deployment',
    heading: 'Bereitstellungsmodell',
    paragraphs: [
      'PhiX ist eine Anwendung zur lokalen Nutzung: als Desktop-Programm (Datenbank auf Ihrem Rechner) oder als Server-Version in Ihrem Netzwerk (Docker auf einem von Ihnen betriebenen Rechner). Es gibt keine zentrale PhiX-Cloud und keinen öffentlichen Internet-Hosting-Dienst des Softwareherstellers, auf dem Ihre Kurs- und Schülerdaten gespeichert würden.',
    ],
  },
  {
    id: 'controller',
    heading: 'Verantwortlicher für Daten in Ihrer Instanz',
    paragraphs: [
      'Verantwortlicher im Sinne der DSGVO für die in PhiX erfassten personenbezogenen Daten (insbesondere Schülerdaten und Noten) ist der Betreiber Ihrer Installation — in der Regel die nutzende Lehrkraft, die Schule oder die von ihr beauftragte Stelle, nicht der Softwarehersteller.',
      'Der Softwarehersteller erhält im Regelbetrieb keinen Zugriff auf diese Daten und verarbeitet sie nicht.',
    ],
  },
  {
    id: 'categories',
    heading: 'Welche Daten die Software speichert',
    paragraphs: [
      'In Ihrer Instanz können u. a. gespeichert werden: Benutzerkonten (Benutzername, Passwort-Hash), Kurs- und Schuljahresdaten, Schülerstammdaten (Name, Klasse, ggf. Nummer), Noten und Leistungsdaten sowie von Ihnen hochgeladene Inhalte (z. B. Fotos). Fachliche Inhalte werden in der Datenbank verschlüsselt abgelegt (siehe technische Dokumentation „Verschlüsselung“ in der Anwendung). Alle Daten verbleiben auf dem von Ihnen gewählten Speicherort (lokale SQLite-Datei oder Ihre PostgreSQL-Instanz).',
    ],
  },
  {
    id: 'no-transmission',
    heading: 'Keine Übermittlung an den Hersteller (Regelbetrieb)',
    paragraphs: [
      'Bei normaler Nutzung werden Kurs-, Schüler- und Notendaten nicht an den Softwarehersteller oder andere Dritte übermittelt. Es findet kein Tracking, keine Analyse-Nutzung und keine automatische Cloud-Synchronisation statt.',
      'Optional und nur auf Ihre Initiative: Registrierungsschlüssel (lokal in Ihrer Datenbank), Spenden über verlinkte externe Anbieter (z. B. PayPal, Buy Me a Coffee) oder Kontakt zum Hersteller außerhalb der Anwendung. Für diese freiwilligen Vorgänge gelten die Datenschutzhinweise des jeweiligen Anbieters bzw. die Angaben im Impressum.',
    ],
  },
  {
    id: 'operator-duties',
    heading: 'Pflichten des Betreibers (Art. 13 und 14 DSGVO)',
    paragraphs: [
      'Wenn Sie PhiX mit personenbezogenen Daten von Schülerinnen und Schülern nutzen, müssen Sie als Verantwortlicher diese Personen (bzw. bei Minderjährigen die Erziehungsberechtigten) über die Verarbeitung informieren — etwa über eine schulische Datenschutzerklärung, Elternbrief oder vergleichbare Regelung Ihrer Schule.',
      'Dazu gehören insbesondere: Zweck und Rechtsgrundlage (z. B. schulische Aufgabenerfüllung, Art. 6 Abs. 1 lit. e DSGVO i. V. m. Landesrecht), Kategorien der Daten, Speicherdauer, Empfänger (falls vorhanden), Rechte der Betroffenen und Kontakt Ihres Datenschutzbeauftragten, sofern einer bestellt ist.',
      'Die folgenden Abschnitte auf dieser Seite ersetzen keine vollständige Datenschutzerklärung Ihrer Schule oder Ihres Trägers.',
    ],
  },
  {
    id: 'rights',
    heading: 'Rechte betroffener Personen',
    paragraphs: [
      'Schülerinnen, Schüler und Erziehungsberechtigte wenden sich für Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit oder Widerspruch an den Verantwortlichen — also an den Betreiber Ihrer PhiX-Instanz (Schule/Lehrkraft), nicht an den Softwarehersteller.',
    ],
  },
  {
    id: 'complaint',
    heading: 'Beschwerderecht',
    paragraphs: [
      'Betroffene Personen können sich bei einer Datenschutz-Aufsichtsbehörde beschweren. Zuständig ist in der Regel die Behörde am Ort des Verantwortlichen (Betreiber), nicht der des Softwareherstellers.',
    ],
  },
  {
    id: 'automated',
    heading: 'Notenberechnung',
    paragraphs: [
      'PhiX berechnet Noten nach von Ihnen hinterlegten Regeln (Gewichtungen, Notenschlüssel). Es gibt keine automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO, die Betroffenen gegenüber rechtliche Wirkung entfaltet oder sie in ähnlicher Weise erheblich beeinträchtigt.',
    ],
  },
];
