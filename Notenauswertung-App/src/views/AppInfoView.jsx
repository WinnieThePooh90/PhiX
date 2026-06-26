import React from 'react';
import { APP_NAME } from '../config/app';
import AppLogo from '../components/AppLogo';
import { APP_VERSION, APP_BUILD_AT } from '../config/appVersion';
import { formatAppBuildAt } from '../utils/formatAppBuild';
import { usePhiXRegistration } from '../utils/phixRegistration';
import { useAuth } from '../store/AuthContext';
import { PHIX_COPYRIGHT, PHIX_LICENSE_SPDX, PHIX_LICENSE_TITLE } from '../config/phixLicense';

export default function AppInfoView({ onOpenSupport, onOpenLicense }) {
  const { registered, unregister } = usePhiXRegistration();
  const { currentUser } = useAuth();

  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">{APP_NAME} unterstützen</h3>
      <div className="program-view-stack">
        <section className="app-info-section glass-panel" aria-labelledby="app-info-registration-heading">
          <div className="app-info-registration-header">
            <h4 id="app-info-registration-heading" className="program-view-panel-heading">
              Registrierung
            </h4>
            {registered ? (
              <button
                type="button"
                className="tab secondary school-roster-control-btn app-info-unregister-btn"
                onClick={() => unregister(currentUser?.username)}
              >
                Registrierung löschen
              </button>
            ) : null}
          </div>
          {!registered ? (
            <p className="program-view-panel-text text-muted app-info-registration-desc">
              Unterstütze mich, um einen Registrierungsschlüssel zu erhalten. Mehr dazu auf der{' '}
              <button type="button" className="app-info-inline-link" onClick={() => onOpenSupport?.()}>
                {APP_NAME}-Unterstützen
              </button>
              -Seite.
            </p>
          ) : null}
          <div className="app-info-registration-status-block">
            <p
              className={`app-info-registration-status${
                registered
                  ? ' app-info-registration-status--registered'
                  : ' app-info-registration-status--unregistered'
              }`}
            >
              {registered ? 'Registriert' : 'Nicht registriert'}
            </p>
            {registered ? (
              <>
                <p className="app-info-registration-thanks">Vielen Dank für deine Unterstützung!</p>
                <p className="app-info-registration-thanks" style={{ marginTop: '0.25rem' }}>
                  Du hast jetzt weitere Farbschemas für PhiX als Dankeschön erhalten. Schau in den Einstellungen nach.
                </p>
              </>
            ) : null}
          </div>
        </section>
      </div>

      <h3 className="program-view-section-heading">Version</h3>
      <section className="app-info-section glass-panel app-info-version-panel" aria-labelledby="app-info-version-heading">
        <h4 id="app-info-version-heading" className="visually-hidden">
          Programmversion
        </h4>
        <div className="app-info-version-brand">
          <AppLogo size={56} />
          <div>
            <p className="app-info-version-number">Version {APP_VERSION}</p>
            <p className="app-info-version-build text-muted">
              Letzter Build: {formatAppBuildAt(APP_BUILD_AT)}
            </p>
          </div>
        </div>
      </section>

      <h3 className="program-view-section-heading">Open Source</h3>
      <section className="app-info-section glass-panel" aria-labelledby="app-info-license-heading">
        <h4 id="app-info-license-heading" className="program-view-panel-heading">
          Lizenz
        </h4>
        <p className="program-view-panel-text text-muted" style={{ marginTop: 0 }}>
          {APP_NAME} steht unter der <strong>{PHIX_LICENSE_TITLE}</strong> (
          <code className="app-info-code">{PHIX_LICENSE_SPDX}</code>). {PHIX_COPYRIGHT}.
        </p>
        {onOpenLicense ? (
          <p className="program-view-panel-text" style={{ marginBottom: 0 }}>
            <button type="button" className="tab secondary" onClick={onOpenLicense}>
              Lizenzdetails anzeigen
            </button>
          </p>
        ) : null}
      </section>

      <h3 className="program-view-section-heading">Hinweise zum Datenschutz (DSGVO)</h3>
      <section className="app-info-section glass-panel" aria-labelledby="app-info-privacy-heading">
        <h4 id="app-info-privacy-heading" className="visually-hidden">
          Hinweise zum Datenschutz
        </h4>
        <p className="program-view-panel-text text-muted" style={{ marginTop: 0 }}>
          {APP_NAME} ist Software zur Verwaltung von Schülerdaten auf Ihrem eigenen Rechner oder Server. Die
          Anwendung stellt dafür nur die technische Umgebung bereit — sie hostet keine zentrale Datenbank und hat im
          Regelbetrieb keinen Zugriff auf die von Ihnen erfassten Inhalte.
        </p>
        <h4 className="program-view-panel-heading" style={{ marginTop: '1.25rem' }}>
          Folgende Daten können in {APP_NAME} gespeichert werden
        </h4>
        <p className="program-view-panel-text text-muted">
          In Ihrer Instanz können u. a. gespeichert werden: Benutzerkonten (Benutzername, Passwort-Hash), Kurs- und
          Schuljahresdaten, Schülerstammdaten (Name, Klasse, ggf. Nummer), Noten und Leistungsdaten sowie von Ihnen
          hochgeladene Inhalte (z. B. Fotos). Fachliche Inhalte werden in der Datenbank verschlüsselt abgelegt (siehe
          technische Dokumentation „Verschlüsselung“ in der Anwendung). Alle Daten verbleiben auf dem von Ihnen
          gewählten Speicherort (lokale SQLite-Datei oder Ihre PostgreSQL-Instanz).
        </p>
        <p className="program-view-panel-text text-muted" style={{ marginBottom: 0 }}>
          Für alle gespeicherten Daten (Namen, Noten, Fotos usw.) sowie für die datenschutzkonforme Nutzung sind Sie
          als Anwenderin oder Anwender verantwortlich. {APP_NAME} übernimmt keine Haftung für von Ihnen eingegebene
          oder importierte Inhalte.
        </p>
      </section>

      <h3 className="program-view-section-heading">Disclaimer</h3>
      <section className="app-info-section glass-panel" aria-labelledby="app-info-disclaimer-heading">
        <h4 id="app-info-disclaimer-heading" className="visually-hidden">
          Disclaimer
        </h4>
        <p className="program-view-panel-text text-muted" style={{ marginTop: 0 }}>
          {APP_NAME} berechnet Noten automatisch auf Grundlage Ihrer Einstellungen — Gewichtungen, Notenschlüssel und
          erfasste Leistungen — und macht den Rechenweg nachvollziehbar. Dennoch können Softwarefehler oder eine
          fehlerhafte Konfiguration zu abweichenden Ergebnissen führen.
        </p>
        <p className="program-view-panel-text text-muted" style={{ marginBottom: 0 }}>
          Bitte prüfen Sie berechnete Noten vor der Verwendung im Unterricht und nutzen Sie {APP_NAME} auf eigenes
          Ermessen. Für fehlerhafte Berechnungen oder daraus entstehende Folgen übernimmt {APP_NAME} keine Haftung.
        </p>
      </section>
    </div>
  );
}
