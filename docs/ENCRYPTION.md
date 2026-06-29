# PhiX – Verschlüsselung

Gilt für **beide Produktvarianten** (Docker-Server mit PostgreSQL und Electron-Desktop mit SQLite).

| Stand | Wert |
|-------|------|
| Eingeführt ab Build | 47 (siehe [`APP_VERSION.md`](APP_VERSION.md) für aktuellen Stand) |
| Letzte inhaltliche Aktualisierung | 2026-06-28 |

---

## Überblick

Sensible fachliche Daten (Kurse, Schüler, Noten, Listen, Schülerverwaltung) werden **pro Benutzer** mit einem zufälligen **DEK** (256 Bit) per **AES-256-GCM** verschlüsselt in der Datenbank gespeichert. Das Passwort schützt den DEK über **Argon2id**; ein **Recovery-Key** bietet eine zweite Hülle.

Nach dem Login hält der Server den DEK nur **im RAM** (Krypto-Session, TTL **5 Minuten** Inaktivität, bei jeder API-Anfrage verlängert). Das Frontend sendet `X-Phix-Crypto-Token` (sessionStorage) für den Datenzugriff. Die **Anmeldung** selbst läuft über ein **HttpOnly-Cookie** (`phix_session`); der Client kann sich nicht mehr per Header als beliebiger Benutzer ausgeben.

---

## Authentifizierung (ab Build 421)

| Mechanismus | Zweck |
|-------------|--------|
| **HttpOnly-Cookie** `phix_session` | Serverseitige Login-Session nach erfolgreichem Login / Recovery |
| **`X-Phix-Crypto-Token`** | Kurzlebige Krypto-Session (DEK im Server-RAM) für verschlüsselte Daten |
| **Einrichtungs-Token** | Einmal-Token beim Anlegen neuer Benutzer durch Admin; Pflicht bei `POST /api/auth/initial-password` (Ausnahme: erster Bootstrap-`admin` ohne Token-Hash) |

`POST /api/auth/crypto/setup` prüft das Passwort gegen den bcrypt-Hash — Setup mit falschem Passwort ist nicht möglich.

Benutzerverwaltung (`GET`/`POST /api/users`) nur für Administratoren. `POST /api/shutdown` nur für Administratoren mit gültiger Anmeldung.

---

## Speicherformat

- Feldwert: `enc:v1:` + Base64(IV 12 B + Auth-Tag 16 B + Ciphertext)
- JSON-Felder: `JSON.stringify` → Verschlüsselung → String (inkl. `advancedWeightingStash`, `gfsGehaltenStash`, `referatGehaltenStash`)

---

## KDF (Argon2id)

- memoryCost: 65536 KiB  
- timeCost: 3  
- parallelism: 4  
- hashLength: 32  

---

## Unverschlüsselt (Allowlist)

Primär-/Fremdschlüssel, `ownerUsername`, Booleans, Struktur-Zahlen (`examNumber`, `maxPoints`, …), `createdAt`, `AppUser` / `UserCrypto` Metadaten, `UserSettings` (Dark Mode, Farbschema).

---

## API

| Route | Zweck |
|-------|--------|
| `POST /api/auth/login` | bcrypt + Auth-Cookie + optional `cryptoSessionToken` |
| `POST /api/auth/logout` | Auth-Cookie und Krypto-Session beenden |
| `GET /api/auth/session` | Angemeldeten Benutzer aus Cookie lesen |
| `POST /api/auth/crypto/setup` | Ersteinrichtung + Recovery-Key (Passwort muss stimmen) |
| `POST /api/auth/initial-password` | Erstes Passwort + Einrichtungs-Token |
| `POST /api/users` | **Admin:** Benutzer anlegen, Response enthält `setupToken` |
| `POST /api/auth/crypto/unlock-recovery` | Passwort mit Recovery-Key + Auth-Cookie |
| `PATCH /api/users/:id/password` | Nur eigenes Konto: bcrypt + DEK re-wrap (`oldPassword` erforderlich) |

Ohne gültige Krypto-Session: **HTTP 423** (außer Login, Session, Setup, Initial-Password, Recovery).

---

## Backup (Format v2)

- **Mein Backup** `?mode=decrypted` (Standard): lesbares JSON  
- **Mein Backup** `?mode=raw`: Ciphertext wie in der DB  
- **Voll-Backup (Admin)**: immer raw, inkl. `userCrypto`  
- Restore von Klartext-Backups: Verschlüsselung mit aktuellem DEK vor dem Speichern  

Format v1-Backups werden beim Restore weiterhin als Klartext behandelt.

Backups sind **variantenübergreifend** nutzbar (Docker ↔ Desktop), sofern Schema und App-Version kompatibel sind.

---

## Grenzen

Schutz vor **DB-Diebstahl** und Backup-Leaks ohne Server-Passwort. **Kein** E2E-Modell: ein kompromittierter Server kann während laufender Sessions Klartext sehen.

- **Docker-Server:** **TLS/HTTPS ist Pflicht** im Schulnetz (Reverse-Proxy vor Port 1990). Ohne TLS sind Passwort, Cookie und Krypto-Token im LAN mitlesbar.
- **Desktop:** Daten lokal auf dem Rechner/USB — physischer Zugriff auf `data/phix.db` schützt die Verschlüsselung nur mit Passwort/Recovery-Key.
- **CORS:** Standardmäßig nur lokale Origins; weitere über `PHIX_CORS_ORIGINS` (kommagetrennt).

---

## Migration

Bestehende Installationen: nach Deploy beim ersten Login **Setup** (DEK anlegen), danach werden vorhandene Klartext-Daten des Benutzers einmalig verschlüsselt. Schülerverwaltung erhält `ownerUsername` (Bestand → `admin`).

Datenbank-Migration `20260628190000_app_user_initial_setup_token`: Spalte `initialSetupTokenHash` für Einrichtungs-Token neuer Benutzer.

---

## Verwandte Dokumentation

| Thema | Datei |
|-------|--------|
| SQLite Desktop / Backup | [`SQLITE_DESKTOP.md`](SQLITE_DESKTOP.md) |
| Docker & Desktop Übersicht | [`BUILD_VERSIONEN.md`](BUILD_VERSIONEN.md) |
| Server-Installation & TLS | [`INSTALL_SERVER_UND_DESKTOP_WINDOWS.md`](INSTALL_SERVER_UND_DESKTOP_WINDOWS.md) |
