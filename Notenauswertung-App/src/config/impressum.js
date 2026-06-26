import { APP_NAME } from './app';

/**
 * Impressum für selbst betriebene PhiX-Instanzen — Angaben zum Softwarehersteller,
 * Verantwortung für Inhalte beim Betreiber der Installation.
 */
export const IMPRESSUM_SECTIONS = [
  {
    id: 'scope',
    heading: 'Art dieser Anwendung',
    paragraphs: [
      `${APP_NAME} ist installierbare Software zur Notenverwaltung auf Ihrem eigenen Rechner oder in Ihrem Netzwerk. Der Softwarehersteller betreibt keine zentrale Online-Plattform und stellt keine Speicherung Ihrer Kurs- und Schülerdaten bereit.`,
    ],
  },
  {
    id: 'operator',
    heading: 'Verantwortlich für Betrieb und Inhalte',
    paragraphs: [
      `Für den Betrieb Ihrer ${APP_NAME}-Installation und für alle darin erfassten Inhalte — Schülerdaten, Noten, Texte, Bilder usw. — sind Sie als nutzende Person, Lehrkraft, Schule oder beauftragte IT-Stelle verantwortlich, nicht der Softwarehersteller.`,
      'Stellen Sie die Server-Version im Schulnetz für andere bereit, kann bei Ihnen eine eigene Impressumspflicht bestehen. Klären Sie dies ggf. mit Schulleitung und Datenschutzbeauftragten.',
    ],
  },
  {
    id: 'provider',
    heading: 'Softwarehersteller',
    lines: ['[Name / Firma]', '[Straße und Hausnummer]', '[PLZ Ort]', 'Deutschland'],
  },
  {
    id: 'contact',
    heading: 'Kontakt zum Softwarehersteller',
    lines: ['E-Mail: [E-Mail-Adresse]'],
    paragraphs: [
      'Dieser Kontakt gilt für Fragen zur Software, zur Lizenz und zur freiwilligen Unterstützung — nicht für Anfragen zu Schülerdaten in Ihrer Instanz, zu denen der Hersteller keinen Zugang hat.',
    ],
  },
  {
    id: 'links',
    heading: 'Externe Links',
    paragraphs: [
      `In ${APP_NAME} können freiwillig Links zu externen Angeboten Dritter angezeigt werden (z. B. Spendenmöglichkeiten). Für deren Inhalte ist jeweils der jeweilige Anbieter verantwortlich.`,
    ],
  },
];
