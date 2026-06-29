# PhiX — Interne HTTP-API

Dokumentation der REST-ähnlichen HTTP-Schnittstelle des PhiX-Backends (`backend/createApp.js`).

| Stand | Wert |
|-------|------|
| **Passend zu Build** | **`432`** (siehe [`APP_VERSION.md`](APP_VERSION.md)) |
| Letzte inhaltliche Aktualisierung | 2026-06-28 |
| Implementierung | `backend/createApp.js` |

---

## Einleitung — keine öffentliche Integrations-API

Diese API ist die **interne Datenschicht der PhiX-Web- und Desktop-Oberfläche**. Sie dient Entwicklern, Self-Hostern und Sicherheitsreviews — **nicht** als stabile Schnittstelle für Drittanbieter (SIS, LMS, eigene Skripte o. Ä.).

| Erwartung | Realität |
|-----------|----------|
| Versionierte, abwärtskompatible Public API | **Nein** — Endpunkte und JSON-Felder können sich mit dem App-Build ändern |
| Zugriff nur mit API-Key | **Nein** — HttpOnly-Session-Cookie **und** Krypto-Token für Daten |
| Lesbarer Zugriff auf Noten ohne Anmeldung | **Nein** — Verschlüsselung + Sitzungsprüfung |

**Quelle der Wahrheit:** bei Abweichungen gilt der Code in `backend/createApp.js`. Dieses Dokument bei größeren API-Änderungen mit dem Build in [`APP_VERSION.md`](APP_VERSION.md) synchron halten.

---

## Architektur

```
Browser / Electron-UI
    │  fetch('/api/...', { credentials: 'include' })
    │  Header: X-Phix-Crypto-Token (Datenzugriff)
    ▼
Express-Backend (Port 3000, Docker: hinter nginx)
    │  Prisma
    ▼
PostgreSQL (Docker-Server)  oder  SQLite (Desktop)
```

- **Docker:** Frontend und API über denselben Origin (z. B. `http://localhost:1990`); nginx leitet `/api` an das Backend weiter.
- **Desktop (Electron):** Backend liefert bei `PHIX_STANDALONE=1` optional das gebaute Frontend mit aus.
- **Entwicklung:** Vite-Proxy oder `VITE_API_BASE_URL` (siehe [`SMOKE_WEB_BASELINE.md`](SMOKE_WEB_BASELINE.md)).

---

## Allgemeine Anforderungen

### Basis-URL

| Umgebung | Typische Basis |
|----------|----------------|
| Docker / Produktion | Relativ: `/api/...` am App-Origin |
| Electron-Dev | `http://127.0.0.1:3000/api/...` (über `VITE_API_BASE_URL`) |

### HTTP

- **Content-Type:** `application/json` für Request-Bodies (außer Datei-Downloads).
- **Body-Limit:** `64mb` (`express.json`).
- **CORS:** `credentials: true`. Standard-Origins: `localhost`/`127.0.0.1` auf Ports 5173, 1990, 3000. Weitere Origins: Umgebungsvariable `PHIX_CORS_ORIGINS` (kommagetrennt). Details: [`ENCRYPTION.md`](ENCRYPTION.md), [`SECURITY.md`](SECURITY.md).

### Schicht 1 — Anmeldung (Auth-Session)

| Aspekt | Wert |
|--------|------|
| Cookie-Name | `phix_session` |
| Art | HttpOnly, serverseitig (In-Memory) |
| Setzen | `POST /api/auth/login`, `POST /api/auth/crypto/unlock-recovery` |
| Löschen | `POST /api/auth/logout` |
| Client | `fetch(..., { credentials: 'include' })` |

Ohne gültiges Cookie: **HTTP 401** `{ "error": "Nicht angemeldet" }` (bei geschützten Routen).

### Schicht 2 — Verschlüsselung (Krypto-Session)

Sensible Felder werden mit **AES-256-GCM** pro Benutzer verschlüsselt. Der Server hält den DEK nur im RAM.

| Aspekt | Wert |
|--------|------|
| Header | `X-Phix-Crypto-Token` |
| Token-Herkunft | Response von `POST /api/auth/login` oder `POST /api/auth/crypto/setup` |
| Speicherung (UI) | `sessionStorage` (`phix_crypto_session_token`) |
| TTL | Inaktivität (Standard 5 Min., einstellbar 5–60 Min. in Benutzereinstellungen); verlängert sich bei API-Anfragen |

Ohne gültigen Krypto-Token (wenn Verschlüsselung eingerichtet): **HTTP 423** mit z. B. `requiresCryptoSetup` oder `requiresCryptoRelogin`.

**Ausnahmen** (kein Krypto-Token nötig) — siehe `backend/lib/crypto-middleware.js`:

- `/api/health`
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/initial-password`, `/api/auth/session`
- `/api/auth/crypto/setup`, `/api/auth/crypto/status`, `/api/auth/crypto/unlock-recovery`
- `/api/registration` (alle Methoden)

### Berechtigungen

| Ebene | Regel |
|-------|--------|
| **Kurse & Kursdaten** | Nur `ownerUsername === angemeldeter Benutzer` |
| **Schuljahres-Verwaltung** | Nur eigene Einträge (`ownerUsername`) |
| **Admin** | `GET`/`POST /api/users`, Admin-Backups, `POST /api/shutdown`, `PATCH /api/users/:id/admin` |
| **Archivierte Kurse** | Lesen erlaubt; Schreiben/Löschen mit wenigen Ausnahmen (z. B. Reaktivierung über `PUT /api/courses/:id` mit `archived: false`) → **403** |

Administratoren sehen **keine** fremden Kursinhalte über die App-APIs.

### Häufige Query-Parameter

| Parameter | Verwendung |
|-----------|------------|
| `courseId` | Fast alle kursgebundenen `GET`/`DELETE`-Routen |
| `schoolYearId` | Schuljahres-Schülerliste |
| `mode` | Backup-Download: `decrypted` \| `raw` |

### ID-Konventionen in Pfaden

Bei **Klausuren, Mündlich, Tests, Projekte** ist `:id` in der URL **nicht** die Prisma-Datenbank-ID, sondern die **Nummer im Kurs** (`examNumber`, `oralNumber`, `testNumber`, `projectNumber`). Im Body bzw. Query wird zusätzlich `courseId` erwartet.

`GET`-Antworten liefern ein **Objekt** `{ [nummer]: datensatz }`, kein Array.

### Typische HTTP-Statuscodes

| Code | Bedeutung |
|------|-----------|
| 200 / 201 | Erfolg mit JSON-Body |
| 204 | Erfolg ohne Body |
| 400 | Ungültige Eingabe |
| 401 | Nicht angemeldet / falsches Passwort |
| 403 | Keine Berechtigung |
| 404 | Ressource nicht gefunden |
| 409 | Konflikt (z. B. Benutzername vergeben) |
| 423 | Krypto-Session fehlt oder abgelaufen |
| 429 | Rate-Limit (`POST /api/auth/initial-password`) |
| 500 | Serverfehler |

Fehlerantworten: `{ "error": "…" }` (teilweise zusätzliche Felder wie `requiresInitialPassword`).

---

## Authentifizierung & Benutzer

| Methode | Pfad | Auth | Krypto | Beschreibung |
|---------|------|------|--------|--------------|
| GET | `/api/health` | — | — | `{ "ok": true }` — Liveness |
| POST | `/api/auth/login` | — | — | Body: `{ username, password }`. Response: Benutzer, `cryptoSessionToken`, `requiresCryptoSetup`, `settings` |
| POST | `/api/auth/logout` | Cookie | optional | Beendet Auth- und Krypto-Session |
| GET | `/api/auth/session` | Cookie | — | Aktueller Benutzer oder 401 |
| POST | `/api/auth/initial-password` | — | — | Erstes Passwort; Body: `{ username, newPassword, setupToken }` |
| GET | `/api/auth/crypto/status` | Cookie | — | `{ ok, needsSetup?, needsRelogin? }` |
| POST | `/api/auth/crypto/setup` | Cookie | — | Ersteinrichtung Verschlüsselung; Body: `{ password }` → `recoveryKey`, `cryptoSessionToken` |
| POST | `/api/auth/crypto/unlock-recovery` | — | — | Passwort-Reset per Recovery-Key; setzt Cookie + Token |
| GET | `/api/users` | Admin | ja | Benutzerliste |
| POST | `/api/users` | Admin | ja | Benutzer anlegen; Response enthält `setupToken` |
| PATCH | `/api/users/:id/password` | eigener User | ja | Body: `{ newPassword, oldPassword? }` |
| DELETE | `/api/users/:id` | Admin oder Selbstlöschung | ja | Löscht Benutzer inkl. Kurse |
| PATCH | `/api/users/:id/admin` | Admin | ja | Body: `{ isAdmin: boolean }` |

Weitere Details: [`ENCRYPTION.md`](ENCRYPTION.md), [`SECURITY.md`](SECURITY.md).

---

## Benutzereinstellungen & Auswertungshilfe

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/api/user-settings` | `inactivityTimeoutMin`, `darkMode`, `colorScheme` |
| PUT | `/api/user-settings` | Einstellungen speichern (Timeout 5–60) |
| GET | `/api/user-auswertungshilfe` | Metadaten der hochgeladenen Auswertungshilfe |
| GET | `/api/user-auswertungshilfe/file` | Datei-Download |
| PUT | `/api/user-auswertungshilfe` | Upload (Base64 im JSON; PDF/DOC/DOCX/TXT/RTF/ODT, max. 10 MB) |
| DELETE | `/api/user-auswertungshilfe` | Auswertungshilfe entfernen |

---

## Registrierung (Produkt-Lizenzschlüssel)

| Methode | Pfad | Krypto | Beschreibung |
|---------|------|--------|--------------|
| GET | `/api/registration` | — | `{ registered: boolean }` |
| POST | `/api/registration` | — | Body: `{ key }` — Registrierungsschlüssel (Format siehe Code) |
| DELETE | `/api/registration` | — | Registrierung zurücksetzen |

---

## Kurse

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/api/courses` | Alle Kurse des angemeldeten Benutzers |
| POST | `/api/courses` | Kurs anlegen (legt Standard-Klausuren, Mündlich, inaktiven Test an) |
| PUT | `/api/courses/:id` | Kurs aktualisieren (`ownerUsername` nicht änderbar) |
| DELETE | `/api/courses/:id` | Kurs inkl. aller abhängigen Daten löschen |

Request-/Response-Felder entsprechen dem Prisma-Modell `Course` (`backend/prisma/schema.prisma`).

---

## Schülerverwaltung (schulweit)

| Methode | Pfad | Query / Body | Beschreibung |
|---------|------|--------------|--------------|
| GET | `/api/school-roster-years` | — | Schuljahre des Benutzers |
| POST | `/api/school-roster-years` | `{ label }` | Schuljahr anlegen |
| DELETE | `/api/school-roster-years/:id` | — | Schuljahr löschen |
| GET | `/api/school-roster-students` | `schoolYearId` | Schüler eines Schuljahres |
| POST | `/api/school-roster-students` | Schüler-Objekt | Schüler anlegen |
| PUT | `/api/school-roster-students/:id` | Schüler-Objekt | Schüler bearbeiten |
| DELETE | `/api/school-roster-students` | `schoolYearId` | Alle Schüler des Jahres löschen |
| DELETE | `/api/school-roster-students/:id` | — | Einzelnen Schüler löschen |

---

## Kurs-Schüler & Leistungen

Alle folgenden Routen erfordern **Kurszugriff** (`courseId` muss dem angemeldeten Benutzer gehören).

### Schüler (pro Kurs)

| Methode | Pfad | Query / Body |
|---------|------|--------------|
| GET | `/api/students` | `?courseId=` |
| POST | `/api/students` | Body inkl. `courseId` |
| PUT | `/api/students/:id` | Prisma-`id` |
| DELETE | `/api/students` | `?courseId=` — gesamte Kursliste leeren |
| DELETE | `/api/students/:id` | Prisma-`id` |

### Klausuren (`:id` = `examNumber`)

| Methode | Pfad | Query / Body |
|---------|------|--------------|
| GET | `/api/exams` | `?courseId=` → `{ "1": {…}, "2": {…} }` |
| PUT | `/api/exams/:id` | Body inkl. `courseId` |
| DELETE | `/api/exams/:id` | `?courseId=` |

### Mündlich (`:id` = `oralNumber`)

| Methode | Pfad | Query / Body |
|---------|------|--------------|
| GET | `/api/orals` | `?courseId=` |
| PUT | `/api/orals/:id` | Body inkl. `courseId` |
| DELETE | `/api/orals/:id` | `?courseId=` |

### Tests (`:id` = `testNumber`)

| Methode | Pfad | Query / Body |
|---------|------|--------------|
| GET | `/api/tests` | `?courseId=` |
| PUT | `/api/tests/:id` | Body inkl. `courseId` |

*(Kein `DELETE` für Tests implementiert.)*

### Projekte (`:id` = `projectNumber`)

| Methode | Pfad | Query / Body |
|---------|------|--------------|
| GET | `/api/projects` | `?courseId=` |
| PUT | `/api/projects/:id` | Body inkl. `courseId` |
| DELETE | `/api/projects/:id` | `?courseId=` |

### GFS

| Methode | Pfad | Query / Body |
|---------|------|--------------|
| GET | `/api/gfs` | `?courseId=` |
| POST | `/api/gfs` | Body inkl. `courseId` |
| PUT | `/api/gfs/:id` | Prisma-`id` |
| DELETE | `/api/gfs/:id` | — |

### Referate

| Methode | Pfad | Query / Body |
|---------|------|--------------|
| GET | `/api/referate` | `?courseId=` |
| POST | `/api/referate` | Body inkl. `courseId` |
| PUT | `/api/referate/:id` | Prisma-`id` |
| DELETE | `/api/referate/:id` | — |

### Album

| Methode | Pfad | Query / Body |
|---------|------|--------------|
| GET | `/api/album-photos` | `?courseId=` |
| POST | `/api/album-photos` | Foto-Metadaten + Bilddaten |
| PUT | `/api/album-photos/:id` | — |
| DELETE | `/api/album-photos/:id` | — |

---

## Klassenlehrer-Listen

Je Kurs (`?courseId=`). Listen haben Einträge; zusätzlich „externe“ Personen pro Liste.

| Ressource | GET | POST | PUT `/:id` | DELETE `/:id` | Einträge |
|-----------|-----|------|------------|---------------|----------|
| Geldlisten | `/api/money-lists` | ja | ja | ja | `PUT /api/money-list-entries/:id`, `POST …/external-entries`, `DELETE …-entries/:id` |
| Anwesenheit | `/api/attendance-lists` | ja | ja | ja | analog `attendance-list-entries` |
| Sammellisten | `/api/collection-lists` | ja | ja | ja | analog `collection-list-entries` |
| Notizenlisten | `/api/notes-lists` | ja | ja | ja | analog `notes-list-entries` |

---

## Backup & Wiederherstellung

| Methode | Pfad | Berechtigung | Parameter |
|---------|------|--------------|-----------|
| GET | `/api/backup/me/download` | angemeldeter User | `?mode=decrypted` (Standard) oder `raw` |
| POST | `/api/backup/me/restore` | angemeldeter User | Body: Backup-JSON (`backup` oder Root-Objekt) |
| GET | `/api/backup/full/download` | Admin | Voll-Backup (immer verschlüsselt/raw) |
| POST | `/api/backup/full/restore` | Admin | Body: Backup-JSON |
| GET | `/api/backup/users/:username/download` | Admin | `?mode=raw` (Standard) oder `decrypted` + Header `X-Phix-Recovery-Key` |
| POST | `/api/backup/users/:username/restore` | Admin | Body inkl. optional `recoveryKey` |

Format und Modi: [`ENCRYPTION.md`](ENCRYPTION.md) (Backup v2).

---

## Betrieb

| Methode | Pfad | Berechtigung | Beschreibung |
|---------|------|--------------|--------------|
| POST | `/api/shutdown` | Admin | Fährt PhiX-Prozess herunter (Desktop / kontrollierter Server-Stopp) |

---

## Request-/Response-Schemas

Es gibt **kein** separates OpenAPI-Schema. Felddefinitionen stehen in:

- `backend/prisma/schema.prisma` (PostgreSQL)
- `backend/prisma/sqlite/schema.prisma` (Desktop, inhaltlich synchron)

Verschlüsselte Felder werden im API-JSON bereits **entschlüsselt** bereitgestellt bzw. beim Schreiben vom Server verschlüsselt — sofern Krypto-Session aktiv ist.

---

## Frontend-Anbindung (Referenz)

| Datei | Rolle |
|-------|--------|
| `Notenauswertung-App/src/utils/apiBase.js` | `apiFetch`, Basis-URL, `credentials: 'include'` |
| `Notenauswertung-App/src/utils/cryptoSession.js` | Krypto-Token in `sessionStorage` |
| `Notenauswertung-App/src/store/AuthContext.jsx` | Login, Logout, Session-Heartbeat |
| `Notenauswertung-App/src/store/DataContext.jsx` | Kurs- und Noten-Daten |

---

## Verwandte Dokumentation

| Thema | Datei |
|-------|--------|
| Verschlüsselung & Backup | [`ENCRYPTION.md`](ENCRYPTION.md) |
| Sicherheit & Datenschutz | [`SECURITY.md`](SECURITY.md) |
| Docker / Desktop / Ports | [`INSTALL_SERVER_UND_DESKTOP_WINDOWS.md`](INSTALL_SERVER_UND_DESKTOP_WINDOWS.md) |
| API-Basis im Frontend-Dev | [`SMOKE_WEB_BASELINE.md`](SMOKE_WEB_BASELINE.md) |

---

## Pflegehinweis

Bei neuen oder geänderten Routen in `createApp.js`:

1. Diese Datei aktualisieren.
2. **Build-Nummer** in der Kopftabelle auf den Stand aus [`APP_VERSION.md`](APP_VERSION.md) setzen.
3. Optional Verweis in [`docs/README.md`](README.md) prüfen.
