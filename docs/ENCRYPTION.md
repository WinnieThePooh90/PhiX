# PhiX – Verschlüsselung (Build 47+)

## Überblick

Sensible fachliche Daten (Kurse, Schüler, Noten, Listen, Schülerverwaltung) werden **pro Benutzer** mit einem zufälligen **DEK** (256 Bit) per **AES-256-GCM** verschlüsselt in der Datenbank gespeichert. Das Passwort schützt den DEK über **Argon2id**; ein **Recovery-Key** bietet eine zweite Hülle.

Nach dem Login hält der Server den DEK nur **im RAM** (Krypto-Session, TTL 8 Stunden). Das Frontend sendet `X-Phix-Crypto-Token` (sessionStorage) zusätzlich zu `X-Acting-User`.

## Speicherformat

- Feldwert: `enc:v1:` + Base64(IV 12 B + Auth-Tag 16 B + Ciphertext)
- JSON-Felder: `JSON.stringify` → Verschlüsselung → String

## KDF (Argon2id)

- memoryCost: 65536 KiB  
- timeCost: 3  
- parallelism: 4  
- hashLength: 32  

## Unverschlüsselt (Allowlist)

Primär-/Fremdschlüssel, `ownerUsername`, Booleans, Struktur-Zahlen (`examNumber`, `maxPoints`, …), `createdAt`, `AppUser` / `UserCrypto` Metadaten.

## API

| Route | Zweck |
|-------|--------|
| `POST /api/auth/login` | bcrypt + optional `cryptoSessionToken` |
| `POST /api/auth/logout` | Krypto-Session beenden |
| `POST /api/auth/crypto/setup` | Ersteinrichtung + Recovery-Key |
| `POST /api/auth/crypto/unlock-recovery` | Passwort vergessen |
| `PATCH /api/users/:id/password` | bcrypt + DEK re-wrap (`oldPassword` erforderlich) |

Ohne gültige Krypto-Session: **HTTP 423** (außer Login/Setup/Session).

## Backup (Format v2)

- **Mein Backup** `?mode=decrypted` (Standard): lesbares JSON  
- **Mein Backup** `?mode=raw`: Ciphertext wie in der DB  
- **Voll-Backup (Admin)**: immer raw, inkl. `userCrypto`  
- Restore von Klartext-Backups: Verschlüsselung mit aktuellem DEK vor dem Speichern  

Format v1-Backups werden beim Restore weiterhin als Klartext behandelt.

## Grenzen

Schutz vor **DB-Diebstahl** und Backup-Leaks ohne Server-Passwort. **Kein** E2E-Modell: ein kompromittierter Server kann während laufender Sessions Klartext sehen. TLS in Produktion weiterhin Pflicht.

## Migration

Bestehende Installationen: nach Deploy beim ersten Login **Setup** (DEK anlegen), danach werden vorhandene Klartext-Daten des Benutzers einmalig verschlüsselt. Schülerverwaltung erhält `ownerUsername` (Bestand → `admin`).
