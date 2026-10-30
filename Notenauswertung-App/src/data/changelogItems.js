/**
 * Chronologische Übersicht der letzten Änderungen für das Changelog-Overlay.
 * Kurze, prägnante Stichpunkte pro Build.
 */
export const CHANGELOG_ITEMS = [
  {
    build: 567,
    date: '30.10.2026',
    title: 'Changelog-Button im Login-Fenster',
    highlights: [
      'Neuer Button „Changelog“ oben rechts im Login-Fenster hinzugefügt.',
      'Kompaktes Overlay zur schnellen Einsicht der letzten Versionen und Neuerungen.',
    ],
  },
  {
    build: 566,
    date: '30.10.2026',
    title: 'Halbschritt-Punktesystem für Sport & Spezialkurse',
    highlights: [
      'Neues Notensystem „Punktesystem in 0,5er Schritten“ (points_half) für die Kursstufe.',
      'Automatische Vorbelegung bei Auswahl des Fachs „Sport“ in der Kursstufe.',
      'Präzise Berechnung mit Halbschritten und einheitliche Anzeige mit einer Dezimalstelle.',
      'Unterstützung in Notenübersichten, Charts sowie Excel- und PDF-Exporten.',
    ],
  },
  {
    build: 565,
    date: '30.10.2026',
    title: 'Scrollposition der Fächer-/Klassenleiste',
    highlights: [
      'Scrollposition der Sidebar bleibt beim Anklicken von Klassen/Fächern erhalten.',
      'Aktives Fach wird bei Bedarf sanft in den sichtbaren Bereich gescrollt.',
    ],
  },
  {
    build: 564,
    date: '28.10.2026',
    title: 'Build- & Syntax-Korrektur',
    highlights: [
      'Entfernung eines fehlerhaften Codefragments im Datenkontext zur Sicherung des Docker-Builds.',
    ],
  },
  {
    build: 563,
    date: '28.10.2026',
    title: 'Aufgabenfelder für Tests',
    highlights: [
      'Tests unterstützen nun beliebig viele Aufgabenfelder (A1, A2, ...) analog zu Klausuren.',
      'Automatische Summenbildung aus Teilaufgaben sowie individuelle Nachschreiber-Aufgabenfelder.',
      'Vollständige Integration in Tabellen-, Diagramm- und PDF-/Excel-Exporte.',
    ],
  },
  {
    build: 562,
    date: '28.10.2026',
    title: 'Notenschlüsselerstellung & Prozentgrenzen',
    highlights: [
      'Button „Leeren“ im Dialog für eigene Notenschlüssel zum Zurücksetzen aller Felder.',
      'Prozentgrenzen (Min/Max %) unterstützen nun zweistellige Dezimalwerte (z. B. 95,25 %).',
      'Optimierte Validierung und Exportdarstellung individueller Notenschlüssel.',
    ],
  },
  {
    build: 561,
    date: '12.10.2026',
    title: 'Layout-Feinschliff im PDF-Export',
    highlights: [
      'Optimierung von vertikalen Abständen und Rahmen im PDF-Tabellenexport.',
    ],
  },
  {
    build: 560,
    date: '12.10.2026',
    title: 'Textausrichtung im PDF-Export',
    highlights: [
      'Exakte Textpositionierung und saubere Ausrichtung der Kopfdaten im PDF-Export.',
    ],
  },
  {
    build: 559,
    date: '12.10.2026',
    title: 'Koordinaten-Anpassung im PDF-Export',
    highlights: [
      'Feinjustierung der Layout-Koordinaten für saubere Druckränder.',
    ],
  },
  {
    build: 558,
    date: '12.10.2026',
    title: 'Korrektur invertierter Textausgabe im PDF-Export',
    highlights: [
      'Behebung spiegelverkehrter / invertierter Textfragmente beim PDF-Export.',
    ],
  },
  {
    build: 557,
    date: '12.10.2026',
    title: 'Faltbare Schülernamensschilder (PDF)',
    highlights: [
      'Neuer PDF-Export für faltbare Tisch-Namensschilder aller Schülerinnen und Schüler.',
      'Beidseitig lesbare Faltvorlage mit Hilfslinien für den direkten Klassenzimmer-Einsatz.',
    ],
  },
  {
    build: 556,
    date: '06.10.2026',
    title: 'Sicherheits- & Krypto-Architektur',
    highlights: [
      'Backend-Verschlüsselungs-Middleware und Authentifizierungskontext modernisiert.',
      'Striktere Krypto-Validierung bei Sitzungsübergängen und API-Endpunkten.',
    ],
  },
  {
    build: 555,
    date: '22.09.2026',
    title: 'Schülerübersicht XLSX-Export bereinigt',
    highlights: [
      'Überflüssiges Übersichtsblatt im Schüler-Excel-Export entfernt für kompaktere Dateien.',
    ],
  },
  {
    build: 554,
    date: '22.09.2026',
    title: 'Notenverlaufs-Chart als Vektorgrafik (SVG)',
    highlights: [
      'SVG-Generator für den individuellen Notenverlauf der Schülerinnen und Schüler.',
      'Nahtlose Einbindung der Verlaufsdiagramme in Excel- und Druckberichte.',
    ],
  },
  {
    build: 553,
    date: '22.09.2026',
    title: 'Einzel-Schülerübersicht als XLSX',
    highlights: [
      'Detaillierter Excel-Export für einzelne Schüler inklusive aller Teilnoten und Durchschnitte.',
    ],
  },
  {
    build: 552,
    date: '22.09.2026',
    title: 'Detaillierter Schülerübersichts-PDF-Export',
    highlights: [
      'Umfassender PDF-Export aller Schülerdaten mit Notenaufstellung und Notizfeldern.',
    ],
  },
];
