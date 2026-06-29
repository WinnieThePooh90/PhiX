import appPkg from '../../package.json';
/** Snapshot der Backend-Abhängigkeiten (gleicher Inhalt wie ../backend/package.json); bei Backend-Updates hier mitpflegen — im Docker-Build liegt kein ../backend/. */
import backendPkg from './backend-package.snapshot.json';
/** Snapshot der Desktop-Build-Abhängigkeiten (gleicher Inhalt wie ../desktop/package.json); nur für Windows-Desktop-Packaging. */
import desktopPkg from './desktop-package.snapshot.json';

/** Kurzbeschreibung je Paket (Deutsch). */
const PURPOSE = {
  // Frontend Laufzeit
  exceljs: 'Excel-Export mit mehreren Tabellenblättern und Formatierung (Notenschlüssel, Gesamtexport).',
  jspdf: 'PDF-Erzeugung im Browser (Export von Tabellen und Kursübersichten).',
  'jspdf-autotable': 'Tabellen-Plugin für jsPDF (formatierte PDF-Tabellen beim Export).',
  'lucide-react': 'SVG-Icon-Bibliothek für Schaltflächen, Suche, Einstellungen u. a.',
  react: 'UI-Bibliothek: Komponenten, Hooks, Rendering-Logik der Anwendung.',
  'react-dom': 'Anbindung von React an den Browser-DOM (Mount, Events, Updates).',
  'react-router-dom': 'Client-seitiges Routing (z. B. Route für „Neues Fach“).',
  xlsx: 'Einlesen von Excel-Dateien (.xlsx) für Schullisten-Import (SheetJS 0.20.3).',
  'xlsx-js-style': 'Excel-Export mit Zellformatierung (Spaltenbreiten, Ausrichtung, Stile).',
  // Backend Laufzeit
  '@prisma/client': 'Typisierter Datenbankzugriff (PostgreSQL/SQLite) aus dem Node-Server.',
  argon2: 'Argon2id-KDF zum Schutz des Datenverschlüsselungsschlüssels (DEK-Hülle).',
  bcryptjs: 'Sicheres Hashen und Prüfen von Benutzerpasswörtern (bcrypt-Algorithmus).',
  cookie: 'Parsen und Setzen des HttpOnly-Session-Cookies (phix_session) für die Anmeldung.',
  cors: 'Cross-Origin Resource Sharing: erlaubt Anfragen der Web-App an den API-Server.',
  dotenv: 'Lädt Umgebungsvariablen (z. B. DATABASE_URL) aus einer .env-Datei.',
  express: 'HTTP-Server und REST-API-Routen für Kurse, Schüler, Benutzer usw.',
  prisma: 'ORM, Schema und Client-Generierung für PostgreSQL und SQLite.',
  // Frontend Entwicklung
  '@eslint/js': 'Standard-Regeln für ESLint (JavaScript).',
  '@types/react': 'TypeScript-Typdefinitionen für React (Editor/Prüfung).',
  '@types/react-dom': 'TypeScript-Typdefinitionen für react-dom.',
  '@vitejs/plugin-react': 'Vite-Plugin: Fast Refresh und JSX für React.',
  eslint: 'Statische Code-Analyse (Linting) im Projekt.',
  'eslint-plugin-react-hooks': 'ESLint-Regeln für korrekte Nutzung von React Hooks.',
  'eslint-plugin-react-refresh': 'ESLint-Regeln für Vite React Fast Refresh.',
  globals: 'Vordefinierte globale Variablen für ESLint-Konfiguration.',
  vite: 'Dev-Server und Bundler für die React-Anwendung.',
  // Backend Entwicklung
  nodemon: 'Startet den Server bei Dateiänderungen neu (nur Entwicklung).',
  // Desktop Build (Electron)
  '@resvg/resvg-js': 'SVG → PNG für das Desktop-App-Icon (Build-Skript).',
  'cross-env': 'Plattformunabhängige Umgebungsvariablen in npm-Skripten (Windows/Linux).',
  electron: 'Desktop-Hülle: eingebetteter Chromium-Browser und Node-Integration für PhiX.',
  'electron-builder': 'Erzeugt das Windows-Desktop-Paket (portable/zip) inkl. gebündeltem Backend.',
};

/** SPDX-ähnliche Kurzbezeichnung; bei Abweichung im Paket siehe Registry. */
const LICENSE = {
  exceljs: 'MIT',
  jspdf: 'MIT',
  'jspdf-autotable': 'MIT',
  'lucide-react': 'ISC',
  react: 'MIT',
  'react-dom': 'MIT',
  'react-router-dom': 'MIT',
  xlsx: 'Apache-2.0',
  'xlsx-js-style': 'Apache-2.0',
  '@prisma/client': 'Apache-2.0',
  argon2: 'MIT',
  bcryptjs: 'BSD-3-Clause',
  cookie: 'MIT',
  cors: 'MIT',
  dotenv: 'BSD-2-Clause',
  express: 'MIT',
  prisma: 'Apache-2.0',
  '@eslint/js': 'MIT',
  '@types/react': 'MIT',
  '@types/react-dom': 'MIT',
  '@vitejs/plugin-react': 'MIT',
  eslint: 'MIT',
  'eslint-plugin-react-hooks': 'MIT',
  'eslint-plugin-react-refresh': 'MIT',
  globals: 'MIT',
  vite: 'MIT',
  nodemon: 'MIT',
  '@resvg/resvg-js': 'MPL-2.0',
  'cross-env': 'MIT',
  electron: 'MIT',
  'electron-builder': 'MIT',
};

function depRows(deps, scope, purposeMap, licenseMap) {
  if (!deps || typeof deps !== 'object') return [];
  return Object.keys(deps)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .map((name) => ({
      scope,
      name,
      version: String(deps[name] ?? ''),
      purpose: purposeMap[name] || 'Unterstützende Bibliothek; Details im jeweiligen npm-Paket.',
      license: licenseMap[name] || 'siehe npm oder LICENSE im Paket',
    }));
}

export function getDependencySections() {
  return {
    frontendRuntime: depRows(appPkg.dependencies, 'Frontend (Laufzeit)', PURPOSE, LICENSE),
    frontendDev: depRows(appPkg.devDependencies, 'Frontend (Entwicklung)', PURPOSE, LICENSE),
    backendRuntime: depRows(backendPkg.dependencies, 'Backend (Laufzeit)', PURPOSE, LICENSE),
    backendDev: depRows(backendPkg.devDependencies, 'Backend (Entwicklung)', PURPOSE, LICENSE),
    desktopBuild: depRows(desktopPkg.devDependencies, 'Desktop (Build)', PURPOSE, LICENSE),
  };
}

/** Erläuterungen zu Lizenzen, die im Projekt vorkommen (Deutsch). */
export const LICENSE_EXPLANATIONS = [
  {
    id: 'MIT',
    title: 'MIT',
    text:
      'Sehr freizügige Open-Source-Lizenz: Sie dürfen den Code nutzen, verändern und weitergeben, inklusive in proprietären Produkten. Voraussetzung ist typischerweise der beigefügte Urheberrechtshinweis und ein Haftungsausschluss. Die Lizenz gewährt keine Markenrechte.',
  },
  {
    id: 'Apache-2.0',
    title: 'Apache License 2.0',
    text:
      'Freizügige Lizenz mit ausdrücklicher Patentlizenz (Schutz vor Patentstreitigkeiten bei Nutzung und Weitergabe). Weitergabe und Änderungen sind erlaubt; bei größeren Änderungen können Kennzeichnungspflichten bestehen. Haftung und Gewährleistung sind ausgeschlossen.',
  },
  {
    id: 'ISC',
    title: 'ISC License',
    text:
      'Minimalistische Genehmigungserklärung, funktional nah an MIT/BSD: Nutzung, Kopie, Modifikation und Verteilung sind erlaubt, sofern der Copyright-Hinweis erhalten bleibt. Keine Gewährleistung.',
  },
  {
    id: 'BSD-2-Clause',
    title: 'BSD 2-Clause „Simplified“',
    text:
      'Permissive Lizenz mit zwei zentralen Klauseln: Namensnennung der Urheber und Haftungs-/Gewährleistungsausschluss. Nutzung in Open-Source und kommerziellen Projekten ist üblich.',
  },
  {
    id: 'BSD-3-Clause',
    title: 'BSD 3-Clause',
    text:
      'Permissive Lizenz mit drei zentralen Klauseln: Namensnennung der Urheber, Verbot der Namensnennung zur Werbung ohne Erlaubnis, sowie Haftungs-/Gewährleistungsausschluss. Nutzung in Open-Source und kommerziellen Projekten ist üblich.',
  },
  {
    id: 'MPL-2.0',
    title: 'Mozilla Public License 2.0',
    text:
      'Schwache Copyleft-Lizenz: Änderungen an den lizenzierten Dateien selbst müssen unter MPL-2.0 weitergegeben werden; größere Werke, die die Dateien nur einbinden, können unter anderen Lizenzen stehen. Typisch für Bibliotheken mit klaren Modul-Grenzen.',
  },
];
