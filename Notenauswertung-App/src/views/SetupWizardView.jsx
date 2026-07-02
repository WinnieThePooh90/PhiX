import React, { useState } from 'react';
import { APP_NAME } from '../config/app';
import { APP_VERSION } from '../config/appVersion';
import AppLogo from '../components/AppLogo';
import PhixCheckboxOption from '../components/PhixCheckboxOption';
import { useAuth } from '../store/AuthContext';
import { apiFetch } from '../utils/apiBase';
import { SETUP_START_TIPS, SETUP_START_TIPS_INTRO } from '../config/setupStartTips';

function passwordsMatch(a, b) {
  return String(a) === String(b);
}

function validatePasswordPair(password, password2) {
  if (!password || !password2) {
    return 'Bitte Passwort und Wiederholung eingeben.';
  }
  if (!passwordsMatch(password, password2)) {
    return 'Die Passwort-Wiederholung stimmt nicht überein.';
  }
  return '';
}

export default function SetupWizardView({ onComplete }) {
  const { setInitialPassword } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [adminPassword, setAdminPassword] = useState('');
  const [adminPassword2, setAdminPassword2] = useState('');

  const [workUsername, setWorkUsername] = useState('');
  const [workPassword, setWorkPassword] = useState('');
  const [workPassword2, setWorkPassword2] = useState('');
  const [workUserIsAdmin, setWorkUserIsAdmin] = useState(true);

  const onSubmitAdmin = async (e) => {
    e.preventDefault();
    setError('');
    const pwErr = validatePasswordPair(adminPassword, adminPassword2);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    setSubmitting(true);
    const r = await setInitialPassword('admin', adminPassword, '');
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error || 'Passwort konnte nicht gespeichert werden.');
      return;
    }
    setStep(2);
  };

  const onSubmitWorkUser = async (e) => {
    e.preventDefault();
    setError('');
    const username = workUsername.trim();
    if (!username) {
      setError('Bitte einen Benutzernamen eingeben.');
      return;
    }
    const pwErr = validatePasswordPair(workPassword, workPassword2);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/setup/work-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: workPassword,
          isAdmin: workUserIsAdmin,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Benutzer konnte nicht angelegt werden.');
        setSubmitting(false);
        return;
      }
      setStep(3);
    } catch {
      setError('Server nicht erreichbar.');
    } finally {
      setSubmitting(false);
    }
  };

  const skipWorkUser = () => {
    setError('');
    onComplete();
  };

  const finishWizard = () => {
    setError('');
    onComplete();
  };

  return (
    <div className="app-login-screen">
      <div className="app-login-card app-login-card--wizard">
        <div className="app-login-brand app-login-brand--solo">
          <AppLogo size={72} />
        </div>
        <h2 className="app-login-title app-login-title--setup">Einrichtungsassistent</h2>

        {step === 1 ? (
          <form className="app-login-form" onSubmit={onSubmitAdmin}>
            <p className="app-login-subtitle app-login-wizard-intro">
              Willkommen bei {APP_NAME}. Da dies eine frische Installation ist, möchte ich dir kurz helfen,
              dein {APP_NAME} einzurichten. Fangen wir an mit dem Standard-User namens „admin“. Gib diesem ein
              starkes Passwort.
            </p>
            <label className="app-login-label">
              <span>Passwort</span>
              <input
                className="app-login-input"
                type="password"
                autoComplete="new-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                disabled={submitting}
              />
            </label>
            <label className="app-login-label">
              <span>Passwort wiederholen</span>
              <input
                className="app-login-input"
                type="password"
                autoComplete="new-password"
                value={adminPassword2}
                onChange={(e) => setAdminPassword2(e.target.value)}
                disabled={submitting}
              />
            </label>
            {error ? (
              <p className="app-login-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="app-login-submit" disabled={submitting}>
              {submitting ? 'Speichern…' : 'Weiter'}
            </button>
          </form>
        ) : null}

        {step === 2 ? (
          <form className="app-login-form" onSubmit={onSubmitWorkUser}>
            <p className="app-login-subtitle app-login-wizard-intro">
              Der admin-Account sollte nur für administrative Zwecke genutzt werden. Deshalb richten wir einen
              weiteren Account für deine Schülerdaten ein. Wähle also einen beliebigen Benutzernamen, mit dem du
              später arbeiten möchtest, und ein starkes Passwort.
            </p>
            <label className="app-login-label">
              <span>Benutzername</span>
              <input
                className="app-login-input"
                type="text"
                autoComplete="username"
                value={workUsername}
                onChange={(e) => setWorkUsername(e.target.value)}
                disabled={submitting}
              />
            </label>
            <label className="app-login-label">
              <span>Passwort</span>
              <input
                className="app-login-input"
                type="password"
                autoComplete="new-password"
                value={workPassword}
                onChange={(e) => setWorkPassword(e.target.value)}
                disabled={submitting}
              />
            </label>
            <label className="app-login-label">
              <span>Passwort wiederholen</span>
              <input
                className="app-login-input"
                type="password"
                autoComplete="new-password"
                value={workPassword2}
                onChange={(e) => setWorkPassword2(e.target.value)}
                disabled={submitting}
              />
            </label>
            <PhixCheckboxOption
              checked={workUserIsAdmin}
              onChange={(e) => setWorkUserIsAdmin(e.target.checked)}
              disabled={submitting}
              wrap
            >
              admin (empfohlen)
            </PhixCheckboxOption>
            {error ? (
              <p className="app-login-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="app-login-submit" disabled={submitting}>
              {submitting ? 'Anlegen…' : 'Weiter'}
            </button>
            <button
              type="button"
              className="tab secondary app-login-wizard-secondary-btn"
              onClick={skipWorkUser}
              disabled={submitting}
            >
              Überspringen
            </button>
          </form>
        ) : null}

        {step === 3 ? (
          <div className="app-login-form">
            <p className="app-login-subtitle app-login-wizard-intro">{SETUP_START_TIPS_INTRO}</p>
            <ol className="app-login-wizard-tips">
              {SETUP_START_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ol>
            <button type="button" className="app-login-submit" onClick={finishWizard}>
              Zur Anmeldung
            </button>
          </div>
        ) : null}
      </div>
      <div className="app-login-footer">
        <p className="app-login-build-info">
          {APP_NAME} by Karsten Paulokat - Build {APP_VERSION}
        </p>
      </div>
    </div>
  );
}
