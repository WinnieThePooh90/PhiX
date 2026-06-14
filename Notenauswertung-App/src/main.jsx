import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import AppLogo from './components/AppLogo';
import LoginView from './views/LoginView';
import RecoveryUnlockView from './views/RecoveryUnlockView';
import CryptoSetupModal from './components/CryptoSetupModal';
import RecoveryKeyModal from './components/RecoveryKeyModal';
import { AuthProvider, useAuth } from './store/AuthContext';
import { DataProvider } from './store/DataContext';
import { DialogProvider } from './components/PhixDialog';
import './index.css';
import { APP_NAME } from './config/app';

document.title = APP_NAME;

function AuthenticatedApp() {
  const {
    currentUser,
    authReady,
    pendingCryptoSetup,
    pendingRecoveryConfirm,
    completeCryptoSetup,
    confirmPendingRecovery,
  } = useAuth();
  const [showRecovery, setShowRecovery] = React.useState(false);
  if (!authReady) {
    return (
      <div className="app-login-screen" aria-busy="true" aria-live="polite">
        <div className="app-login-card">
          <div className="app-login-brand">
            <AppLogo size={72} />
            <h1 className="app-login-title">{APP_NAME}</h1>
          </div>
          <p className="app-login-subtitle">Wird geladen…</p>
        </div>
      </div>
    );
  }
  if (!currentUser) {
    if (showRecovery) {
      return (
        <RecoveryUnlockView
          onUnlocked={(body) => {
            setShowRecovery(false);
            try {
              localStorage.setItem('notenauswertung_session_username', body.username);
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
        />
      );
    }
    return <LoginView onRecovery={() => setShowRecovery(true)} />;
  }
  if (pendingRecoveryConfirm) {
    return (
      <RecoveryKeyModal
        username={pendingRecoveryConfirm.username}
        recoveryKey={pendingRecoveryConfirm.recoveryKey}
        successMessage="Ihre Verschlüsselung wurde eingerichtet. Bitte den Recovery-Key sichern, bevor Sie fortfahren."
        confirmLabel="Weiter zur App"
        onClose={confirmPendingRecovery}
      />
    );
  }
  if (pendingCryptoSetup) {
    if (pendingCryptoSetup.needsRelogin) {
      return (
        <div className="app-login-screen">
          <div className="app-login-card">
            <div className="app-login-brand">
              <AppLogo size={72} />
              <h1 className="app-login-title">{APP_NAME}</h1>
            </div>
            <p className="app-login-subtitle">
              {pendingCryptoSetup.needsSetup
                ? 'Bitte erneut anmelden. Beim ersten Login nach dem Update richten Sie die Verschlüsselung ein (Recovery-Key).'
                : 'Die Verschlüsselungs-Sitzung ist abgelaufen oder ungültig. Bitte erneut anmelden.'}
            </p>
            <button
              type="button"
              className="app-login-submit"
              onClick={() => {
                try {
                  localStorage.removeItem('notenauswertung_session_username');
                } catch {
                  /* ignore */
                }
                window.location.reload();
              }}
            >
              Zur Anmeldung
            </button>
          </div>
        </div>
      );
    }
    return (
      <CryptoSetupModal
        username={pendingCryptoSetup.username}
        password={pendingCryptoSetup.password}
        onComplete={completeCryptoSetup}
      />
    );
  }
  return (
    <DataProvider>
      <App />
    </DataProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <DialogProvider>
        <AuthProvider>
          <Routes>
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </AuthProvider>
      </DialogProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
