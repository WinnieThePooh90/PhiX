# PhiX – Verschlüsselung

Gilt für **beide Produktvarianten** (Docker-Server mit PostgreSQL und Electron-Desktop mit SQLite).

| Stand | Wert |
|-------|------|
| Eingeführt ab Build | 47 (siehe [`APP_VERSION.md`](APP_VERSION.md) für aktuellen Stand) |
| Letzte inhaltliche Aktualisierung | 2026-06-28 |

---

## Überblick

Sensible fachliche Daten (Kurse, Schüler, Noten, Listen, Schülerverwaltung) werden **pro Benutzer** mit einem zufälligen **DEK** (256 Bit) per **AES-256-GCM** verschlüsselt in der Datenbank gespeichert. Das Passwort schützt den DEK über **Argon2id**; ein **Recovery-Key** bietet eine zweite Hülle.

Nach dem Login hält der Server den DEK nur **im RAM** (Krypto-Session, TTL **5 Minuten** Inaktivität, bei jeder API-Anfrage verlängert). Das Frontend sendet `X-Phix-Crypto-Token` (sessionStorage) zusätzlich zu `X-Acting-User` und meldet nach **5 Minuten** ohne Nutzeraktivität automatisch ab.

---

## Speicherformat

- Feldwert: `enc:v1:` + Base64(IV 12 B + Auth-Tag 16 B + Ciphertext)
- JSON-Felder: `JSON.stringify` → Verschlüsselung → String

---

## KDF (Argon2id)

- memoryCost: 65536 KiB  
- timeCost: 3  
- parallelism: 4  
- hashLength: 32  

---

## Unverschlüsselt (Allowlist)

Primär-/Fremdschlüssel, `ownerUsername`, Booleans, Struktur-Zahlen (`examNumber`, `maxPoints`, …), `createdAt`, `AppUser` / `UserCrypto` Metadaten.

---

## API

| Route | Zweck |
|-------|--------|
| `POST /api/auth/login` | bcrypt + optional `cryptoSessionToken` |
| `POST /api/auth/logout` | Krypto-Session beenden |
| `POST /api/auth/crypto/setup` | Ersteinrichtung + Recovery-Key (erster Login eines neuen Benutzers) |
| `POST /api/auth/initial-password` | Erstes Passwort (nur `mustSetPassword`, vom Benutzer selbst) |
| `POST /api/users` | Nur Benutzername; Passwort legt der Nutzer beim ersten Login selbst fest |
| `POST /api/auth/crypto/unlock-recovery` | Eigenes Passwort mit Recovery-Key |
| `PATCH /api/users/:id/password` | Nur eigenes Konto: bcrypt + DEK re-wrap (`oldPassword` erforderlich) |

Ohne gültige Krypto-Session: **HTTP 423** (außer Login/Setup/Session).

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

- **Docker-Server:** TLS/HTTPS vor dem Schulnetz empfohlen (Reverse-Proxy vor Port 1990).
- **Desktop:** Daten lokal auf dem Rechner/USB — physischer Zugriff auf `data/phix.db` schützt die Verschlüsselung nur mit Passwort/Recovery-Key.

---

## Migration

Bestehende Installationen: nach Deploy beim ersten Login **Setup** (DEK anlegen), danach werden vorhandene Klartext-Daten des Benutzers einmalig verschlüsselt. Schülerverwaltung erhält `ownerUsername` (Bestand → `admin`).

---

## Verwandte Dokumentation

| Thema | Datei |
|-------|--------|
| SQLite Desktop / Backup | [`SQLITE_DESKTOP.md`](SQLITE_DESKTOP.md) |
| Docker & Desktop Übersicht | [`BUILD_VERSIONEN.md`](BUILD_VERSIONEN.md) |
