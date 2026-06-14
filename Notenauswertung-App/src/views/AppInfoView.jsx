import React from 'react';
import { APP_NAME } from '../config/app';
import AppLogo from '../components/AppLogo';
import { APP_VERSION, APP_BUILD_AT } from '../config/appVersion';
import { formatAppBuildAt } from '../utils/formatAppBuild';
import { usePhiXRegistration } from '../utils/phixRegistration';
import { useAuth } from '../store/AuthContext';
import { DSGVO_SECTIONS } from '../config/dsgvo';
import LegalContentSections from '../components/LegalContentSections';

export default function AppInfoView({ onOpenSupport }) {
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

      <h3 className="program-view-section-heading">Angaben nach DSGVO</h3>
      <p className="text-muted program-view-intro program-view-intro--tight">
        Informationspflichten nach Art. 13 und 14 der Datenschutz-Grundverordnung (DSGVO).
      </p>
      <LegalContentSections sections={DSGVO_SECTIONS} />
    </div>
  );
}
