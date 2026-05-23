import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import LoginView from './views/LoginView';
import RecoveryUnlockView from './views/RecoveryUnlockView';
import CryptoSetupModal from './components/CryptoSetupModal';
import { AuthProvider, useAuth } from './store/AuthContext';
import { DataProvider } from './store/DataContext';
import './index.css';
import { APP_NAME } from './config/app';

document.title = APP_NAME;

function AuthenticatedApp() {
  const { currentUser, authReady, pendingCryptoSetup, completeCryptoSetup } = useAuth();
  const [showRecovery, setShowRecovery] = React.useState(false);
  if (!authReady) return null;
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
  if (pendingCryptoSetup) {
    if (pendingCryptoSetup.needsRelogin) {
      return (
        <div className="app-login-screen">
          <div className="app-login-card">
            <p>Die Verschlüsselungs-Sitzung ist abgelaufen. Bitte erneut anmelden.</p>
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
      <AuthProvider>
        <Routes>
          <Route path="/*" element={<AuthenticatedApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
