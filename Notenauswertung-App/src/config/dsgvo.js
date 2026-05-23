/**
 * Pflichtangaben nach Art. 13 und 14 DSGVO (Informationspflichten).
 * Bitte mit Ihren tatsächlichen Angaben ergänzen und ggf. rechtlich prüfen lassen.
 */
export const DSGVO_SECTIONS = [
  {
    id: 'controller',
    heading: 'Verantwortlicher',
    lines: ['[Name / Firma]', '[Straße und Hausnummer]', '[PLZ Ort]', 'E-Mail: [E-Mail-Adresse]'],
  },
  {
    id: 'dpo',
    heading: 'Datenschutzbeauftragter (falls bestellt)',
    lines: [
      '[Name des Datenschutzbeauftragten oder: Ein Datenschutzbeauftragter ist nicht bestellt.]',
      'E-Mail: [E-Mail-Adresse]',
    ],
  },
  {
    id: 'purposes',
    heading: 'Zwecke und Rechtsgrundlagen der Verarbeitung',
    paragraphs: [
      'Wir verarbeiten personenbezogene Daten zur Bereitstellung und Nutzung der Anwendung (insbesondere Benutzerkonten, Kurs- und Notendaten, Schülerverwaltung). Rechtsgrundlagen sind je nach Vorgang insbesondere Art. 6 Abs. 1 lit. b DSGVO (Vertrag/Nutzung), lit. c (rechtliche Verpflichtung) und lit. f (berechtigtes Interesse an einem sicheren, funktionsfähigen Betrieb) sowie ggf. lit. a (Einwilligung).',
    ],
  },
  {
    id: 'categories',
    heading: 'Kategorien personenbezogener Daten',
    paragraphs: [
      'Verarbeitet werden u. a. Stammdaten (z. B. Benutzername, E-Mail), schulische Daten (Fächer, Klassen, Schuljahre), Schülerdaten (Name, Klasse, ggf. Nummer) sowie Noten- und Leistungsdaten, soweit Sie diese in der Anwendung erfassen. Fachliche Inhalte werden in der Datenbank verschlüsselt gespeichert (siehe technische Dokumentation „Verschlüsselung“ in der Anwendung); Passwörter liegen nur als Hash vor.',
    ],
  },
  {
    id: 'recipients',
    heading: 'Empfänger und Übermittlung',
    paragraphs: [
      'Eine Weitergabe erfolgt nur, soweit dies für den Betrieb erforderlich ist (z. B. Hosting/IT-Dienstleister als Auftragsverarbeiter nach Art. 28 DSGVO) oder eine gesetzliche Pflicht besteht. Eine Übermittlung in Drittländer findet nur statt, wenn die Voraussetzungen der Art. 44 ff. DSGVO erfüllt sind.',
    ],
  },
  {
    id: 'retention',
    heading: 'Speicherdauer',
    paragraphs: [
      'Personenbezogene Daten werden nur so lange gespeichert, wie es für die genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen. Danach werden die Daten gelöscht oder anonymisiert, sofern keine berechtigten Gründe für eine weitere Speicherung entgegenstehen.',
    ],
  },
  {
    id: 'rights',
    heading: 'Rechte der betroffenen Personen',
    paragraphs: [
      'Sie haben nach der DSGVO insbesondere das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Sofern die Verarbeitung auf einer Einwilligung beruht, können Sie diese jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO).',
    ],
  },
  {
    id: 'complaint',
    heading: 'Beschwerderecht bei einer Aufsichtsbehörde',
    paragraphs: [
      'Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere in dem Mitgliedstaat Ihres gewöhnlichen Aufenthaltsorts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes.',
    ],
  },
  {
    id: 'obligation',
    heading: 'Bereitstellung der Daten / Pflicht zur Angabe',
    paragraphs: [
      'Die Bereitstellung bestimmter Daten kann für die Nutzung der Anwendung erforderlich sein. Ohne diese Daten ist eine vollständige Nutzung ggf. nicht möglich. Eine gesetzliche Verpflichtung zur Bereitstellung besteht nur, soweit dies ausdrücklich genannt ist.',
    ],
  },
  {
    id: 'automated',
    heading: 'Automatisierte Entscheidungsfindung',
    paragraphs: [
      'Es findet keine ausschließlich auf einer automatisierten Verarbeitung — einschließlich Profiling — beruhende Entscheidungsfindung im Sinne von Art. 22 DSGVO statt, die Ihnen gegenüber rechtliche Wirkung entfaltet oder Sie in ähnlicher Weise erheblich beeinträchtigt.',
    ],
  },
];
