/** Automatisches Abmelden nach Inaktivität (Frontend + Server-Krypto-Session). */
export const INACTIVITY_LOGOUT_MS = 5 * 60 * 1000;

/** Intervall für Hintergrund-Prüfung der Krypto-Sitzung (ohne TTL-Verlängerung). */
export const SESSION_HEARTBEAT_MS = 30 * 1000;
